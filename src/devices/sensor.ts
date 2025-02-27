/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Service, Characteristic } from 'homebridge';
import { wallboxPlatform } from '../wallboxplatform.js';

export default class sensor {
	public readonly Service!: typeof Service;
	public readonly Characteristic!: typeof Characteristic;
	constructor(
		private readonly platform: wallboxPlatform,
	) { }

	createSensorService(device: any, type: string): Service {
		this.platform.log.info('Adding sensor for %s charger ', device.name);
		this.platform.log.debug('create new sensor');
		let humiditySensor = new this.platform.Service.HumiditySensor(type, device.id);
		let stateOfCharge = 0;
		if (device.stateOfCharge) {
			stateOfCharge = device.stateOfCharge;
		}
		humiditySensor = new this.platform.Service.HumiditySensor(type, device.id);
		humiditySensor.setCharacteristic(this.platform.Characteristic.Name, device.name + ' ' + type).setCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, stateOfCharge);
		return humiditySensor;
	}

	configureSensorService(device: any, sensorStatus: any) {
		this.platform.log.debug('configured %s sensor for %s', sensorStatus.getCharacteristic(this.platform.Characteristic.Name).value, device.name);
		sensorStatus.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity);
	}
}
