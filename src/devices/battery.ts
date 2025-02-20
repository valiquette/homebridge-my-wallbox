/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, Service, Characteristic } from 'homebridge';
import { wallboxPlatform } from '../wallboxplatform.js';

export default class battery {
	public readonly Service!: typeof Service;
	public readonly Characteristic!: typeof Characteristic;
	constructor(
		private readonly platform: wallboxPlatform,
	) { }

	createBatteryService(device: any): Service {
		this.platform.log.info('Adding battery service for %s charger ', device.name);
		this.platform.log.debug('create battery service for %s', device.name);
		let stateOfCharge = 0;
		if (device.stateOfCharge) {
			stateOfCharge = device.stateOfCharge;
		}
		const batteryStatus: Service = new this.platform.Service.Battery(device.name, device.id);
		batteryStatus
			.setCharacteristic(this.platform.Characteristic.StatusLowBattery, this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL)
			.setCharacteristic(this.platform.Characteristic.BatteryLevel, stateOfCharge)
			.setCharacteristic(this.platform.Characteristic.ChargingState, this.platform.Characteristic.ChargingState.NOT_CHARGING)
			.setCharacteristic(this.platform.Characteristic.ActiveIdentifier, device.maxAvailableCurrent);
		return batteryStatus;
	}

	configureBatteryService(batteryStatus: Service) {
		this.platform.log.debug('configured battery service for %s', batteryStatus.getCharacteristic(this.platform.Characteristic.Name).value);
		batteryStatus.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
			.onGet(this.getStatusLowBattery.bind(this, batteryStatus));
	}

	getStatusLowBattery(batteryStatus: Service): Promise<CharacteristicValue> {
		const batteryValue: any = batteryStatus.getCharacteristic(this.platform.Characteristic.BatteryLevel).value;
		let currentValue: any = batteryStatus.getCharacteristic(this.platform.Characteristic.StatusLowBattery).value;
		if (batteryValue <= 10) {
			this.platform.log.warn('Battery Status Low %s%', batteryValue);
			batteryStatus.setCharacteristic(this.platform.Characteristic.StatusLowBattery, this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
			currentValue = this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
		}
		return currentValue;
	}
}

