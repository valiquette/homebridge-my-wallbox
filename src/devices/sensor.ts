/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Service, Characteristic } from 'homebridge';
import  wallboxPlatform from '../wallboxplatform.js';

export default class sensor {
	public readonly Service: typeof Service;
	public readonly Characteristic: typeof Characteristic;
	constructor(
		private readonly platform: wallboxPlatform,
		private log = platform.log,
	) {
		this.Service = platform.Service;
		this.Characteristic = platform.Characteristic;
	}
	createSensorService(device: any, type: string): Service {
		this.log.info('Adding sensor for %s charger ', device.name);
		this.log.debug('create new sensor');
		let stateOfCharge = 0;
		if (device.stateOfCharge) {
			stateOfCharge = device.stateOfCharge;
		}
		const humiditySensor = new this.Service.HumiditySensor(type, device.id);
		humiditySensor.setCharacteristic(this.Characteristic.Name, device.name + ' ' + type).setCharacteristic(this.Characteristic.CurrentRelativeHumidity, stateOfCharge);
		return humiditySensor;
	}

	configureSensorService(device: any, sensorStatus: any) {
		this.log.debug('configured %s sensor for %s', sensorStatus.getCharacteristic(this.Characteristic.Name).value, device.name);
		sensorStatus.getCharacteristic(this.Characteristic.CurrentRelativeHumidity);
	}
}
