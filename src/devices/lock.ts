/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import { wallboxPlatform } from '../wallboxplatform.js';

import { PLUGIN_VERSION } from '../settings.js';
import wallboxAPI from '../wallboxapi.js';

export default class lock {
	public readonly Service!: typeof Service;
	public readonly Characteristic!: typeof Characteristic;
	constructor(
		private readonly platform: wallboxPlatform,
		private wallboxapi = new wallboxAPI(platform),
	) {}

	createLockAccessory(device: any, config: any, uuid: string, lockAccessory: PlatformAccessory) {
		if (!lockAccessory) {
			this.platform.log.info('Adding lock for %s charger ', device.name);
			this.platform.log.debug('create Lock Accessory %s', device.name);
			lockAccessory = new this.platform.api.platformAccessory(device.name, uuid);
			const lockService = new this.platform.Service.LockMechanism(device.name, device.id);
			lockService.addCharacteristic(this.platform.Characteristic.Identifier);
			lockService.addCharacteristic(this.platform.Characteristic.StatusFault);
			lockService.addCharacteristic(this.platform.Characteristic.OutletInUse);
			lockService.addCharacteristic(this.platform.Characteristic.AccessoryIdentifier);
			lockAccessory.addService(lockService);
		} else {
			this.platform.log.debug('update Lock Accessory %s', device.name);
		}
		lockAccessory.getService(this.platform.Service.AccessoryInformation)!
		  .setCharacteristic(this.platform.Characteristic.Name, device.name)
		  .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Wallbox')
		  .setCharacteristic(this.platform.Characteristic.SerialNumber, device.serialNumber)
		  .setCharacteristic(this.platform.Characteristic.Model, this.platform.model_name)
		  .setCharacteristic(this.platform.Characteristic.Identify, true)
		  .setCharacteristic(this.platform.Characteristic.FirmwareRevision, config.software.currentVersion)
		  .setCharacteristic(this.platform.Characteristic.HardwareRevision, config.part_number)
		  .setCharacteristic(this.platform.Characteristic.SoftwareRevision, PLUGIN_VERSION);

		lockAccessory.getService(this.platform.Service.LockMechanism)!
		  .setCharacteristic(this.platform.Characteristic.Name, device.name)
		  .setCharacteristic(this.platform.Characteristic.Identifier, device.serialNumber)
		  .setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.NO_FAULT)
		  .setCharacteristic(this.platform.Characteristic.OutletInUse, false)
		  .setCharacteristic(this.platform.Characteristic.AccessoryIdentifier, device.uniqueIdentifier);

		return lockAccessory;
	}

	configureLockService(device: any, lockService: Service) {
		this.platform.log.debug('configured %s lock for %s', lockService.getCharacteristic(this.platform.Characteristic.Name).value, device.name);
		lockService.setCharacteristic(this.platform.Characteristic.LockCurrentState, device.locked);
		lockService.setCharacteristic(this.platform.Characteristic.LockTargetState, device.locked);
		lockService.getCharacteristic(this.platform.Characteristic.LockCurrentState)
			.onGet(this.getLockCurrentState.bind(this, device, lockService));
		lockService.getCharacteristic(this.platform.Characteristic.LockTargetState)
			.onGet(this.getLockTargetState.bind(this, lockService))
			.onSet(this.setLockTargetState.bind(this, lockService));

	}

	async getLockCurrentState(device: any, lockService: Service): Promise<CharacteristicValue> {
		this.platform.startLiveUpdate(device);
		const currentValue: any = lockService.getCharacteristic(this.platform.Characteristic.LockCurrentState).value;
		return currentValue;
	}

	async getLockTargetState(lockService: Service): Promise<CharacteristicValue> {
		const currentValue: any = lockService.getCharacteristic(this.platform.Characteristic.LockTargetState).value;
		return currentValue;
	}

	async setLockTargetState(lockService: Service, lockState: any) {
		if (lockService.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			if (lockState === this.platform.Characteristic.LockTargetState.SECURED) {
				this.platform.log.info('Locking %s', lockService.getCharacteristic(this.platform.Characteristic.Name).value);
				const chargerId = lockService.getCharacteristic(this.platform.Characteristic.Identifier).value;
				const response = await this.wallboxapi.lock(this.platform.token, chargerId, lockState).catch((err: any) => {
					this.platform.log.error('Failed to lock.', err);
					return err;
				});
				try {
					switch (response.status) {
					case 200:
						lockService.getCharacteristic(this.platform.Characteristic.LockCurrentState).updateValue(this.platform.Characteristic.LockCurrentState.SECURED);
						break;
					default:
						lockService.getCharacteristic(this.platform.Characteristic.LockTargetState).updateValue(this.platform.Characteristic.LockTargetState.UNSECURED);
						this.platform.log.info('Failed to lock WallBox');
						break;
					}
				} catch (error) {
					this.platform.log.error('Failed to lock Wallbox');
				}
				return;
			}
			if (lockState === this.platform.Characteristic.LockTargetState.UNSECURED) {
				this.platform.log.info('Unlocking %s', lockService.getCharacteristic(this.platform.Characteristic.Name).value);
				const chargerId = lockService.getCharacteristic(this.platform.Characteristic.Identifier).value;
				const response = await this.wallboxapi.lock(this.platform.token, chargerId, lockState).catch((err: any) => {
					this.platform.log.error('Failed to unlock.', err);
					return err;
				});
				try {
					switch (response.status) {
					case 200:
						lockService.getCharacteristic(this.platform.Characteristic.LockCurrentState).updateValue(this.platform.Characteristic.LockCurrentState.UNSECURED);
						break;
					default:
						lockService.getCharacteristic(this.platform.Characteristic.LockTargetState).updateValue(this.platform.Characteristic.LockTargetState.SECURED);
						this.platform.log.info('Failed to unlock WallBox');
						break;
					}
				} catch (error) {
					this.platform.log.error('Failed to unlock Wallbox');
				}
				return;
			}
			return;
		}
	}
}
