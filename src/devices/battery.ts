/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, Service, Characteristic } from 'homebridge';
import  wallboxPlatform from '../wallboxplatform.js';

export default class battery {
	public readonly Service: typeof Service;
	public readonly Characteristic: typeof Characteristic;
	constructor(
		private readonly platform: wallboxPlatform,
		private log = platform.log,
	) {
		this.Service = platform.Service;
		this.Characteristic = platform.Characteristic;
	}

	createBatteryService(device: any): Service {
		this.log.info('Adding battery service for %s charger ', device.name);
		this.log.debug('create battery service for %s', device.name);
		let stateOfCharge = 0;
		if (device.stateOfCharge) {
			stateOfCharge = device.stateOfCharge;
		}
		const batteryStatus: Service = new this.Service.Battery(device.name, device.id);
		batteryStatus
			.setCharacteristic(this.Characteristic.StatusLowBattery, this.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL)
			.setCharacteristic(this.Characteristic.BatteryLevel, stateOfCharge)
			.setCharacteristic(this.Characteristic.ChargingState, this.Characteristic.ChargingState.NOT_CHARGING)
			.setCharacteristic(this.Characteristic.ActiveIdentifier, device.maxAvailableCurrent);
		return batteryStatus;
	}

	configureBatteryService(batteryStatus: Service) {
		this.log.debug('configured battery service for %s', batteryStatus.getCharacteristic(this.Characteristic.Name).value);
		batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery)
			.onGet(this.getStatusLowBattery.bind(this, batteryStatus));
	}

	getStatusLowBattery(batteryStatus: Service): Promise<CharacteristicValue> {
		const batteryValue: any = batteryStatus.getCharacteristic(this.Characteristic.BatteryLevel).value;
		let currentValue: any = batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).value;
		if (batteryValue <= 1) {
			this.log.warn('Battery Status Low %s%', batteryValue);
			batteryStatus.updateCharacteristic(this.Characteristic.StatusLowBattery, this.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
			currentValue = this.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
		}
		return currentValue;
	}
}

