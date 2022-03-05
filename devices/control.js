let packageJson=require('../package.json')
let wallboxAPI=require('../wallboxapi')

function control (platform,log,config){
	this.log=log
	this.platform=platform
	this.wallboxapi=new wallboxAPI(this,log)
}

control.prototype={

  createControlService(device, type){
    this.log.debug('adding new control')
		//let currentAmps=Math.round((device.maxChargingCurrent-32)*5/9)
		let currentAmps=((device.maxChargingCurrent-32)*5/9).toFixed(2)
		let currentTemp=((0-32)*5/9).toFixed(2)
		let controlService=new Service.Thermostat(type, device.id)
    controlService 
      .setCharacteristic(Characteristic.Name, type)
      .setCharacteristic(Characteristic.StatusFault,false)
			.setCharacteristic(Characteristic.TargetTemperature, currentAmps) //4.4444
			.setCharacteristic(Characteristic.CurrentTemperature, currentTemp) //-17.7778
			.setCharacteristic(Characteristic.TemperatureDisplayUnits,false)
			.setCharacteristic(Characteristic.TargetHeatingCoolingState,0)
			.setCharacteristic(Characteristic.CurrentHeatingCoolingState,0)
    return controlService
  },

  configureControlService(device, controlService){
		let min=-14.5
		let max=4.5
		if(device.maxAvailableCurrent==48){max=9}
    this.log.info("Configured %s control for %s" , controlService.getCharacteristic(Characteristic.Name).value, device.name)
		controlService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
			.setProps({
					minValue:0,
					maxValue:1
				})
      .on('get', this.getControlState.bind(this, controlService))
      .on('set', this.setControlState.bind(this, device, controlService))
		controlService
      .getCharacteristic(Characteristic.TargetTemperature)
			.setProps({
					minStep:.5,
					minValue:min,
					maxValue:max
			})
      .on('get', this.getControlAmps.bind(this, controlService))
      .on('set', this.setControlAmps.bind(this, device, controlService))
  },

	setControlAmps(device, controlService, value, callback){
		//let amps=Math.round(value*1.8+32)
		let amps=(value*1.8+32).toFixed(2)
		this.log.debug('set amps',value, amps)
		this.wallboxapi.setAmps(this.platform.token,device.id,amps).then(response=>{
			this.log.debug(response.data)
		})	

		callback()
		},

	setControlState(device, controlService, value, callback){
		this.wallboxapi.getChargerData(this.platform.token,device.id).then(state=>{
			this.log.warn('check current state %s:%s',state.data.data.chargerData.status,state.data.data.chargerData.statusDescription)
			if(state.data.data.chargerData.status==(161 || 181 || 194 || 209)){
			//if(state.data.data.chargerData.statusDescription==("Ready" || "Charging" || "Connected: waiting for car demand" || "Locked")){
				this.log.debug('toggle switch state %s',controlService.getCharacteristic(Characteristic.Name).value)
				if(controlService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
					callback('error')
				}
				else{
					if(value){
						this.wallboxapi.remoteAction(this.platform.token,device.id,'start_charging').then(response=>{
							switch(response.status){
								case 200:
									controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(value)
									break
								case 202:
									controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(value)
									break	
								case 400:
									controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
									this.log.info('Failed to start charging %s',response.data.title)
									this.log.debug(response.data)
									break
								default:
									controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(!value)
									controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
									this.log.debug(response.data)
									break	
								}
						})	
					} 
					else {
						this.wallboxapi.remoteAction(this.platform.token,device.id,'stop_charging').then(response=>{
							switch(response.status){
								case 200:
									controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(value)
									break
								case 202:
									controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(value)
									break	
								case 403:
									controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(!value)
									controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
									this.log.info('Failed to stop charging %s',response.data.title)
									this.log.debug(response.data)
									break
								default:
									controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(!value)
									controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
									this.log.debug(response.data)
									break	
								}
						})	
					}
					callback()
				} 
			}
			else{
				this.log.info('Unable to start at this time')
				controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(false)
				controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(false)
				callback()
			}	
		})
	},

	getControlState(controlService, callback){
		if(controlService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
			//callback('error')
		}
		else{
			let currentValue=controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).value
			this.log.debug('get state',currentValue)
			callback(null, currentValue)
		}
	}, 

	getControlAmps(controlService, callback){
		if(controlService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
			//callback('error')
		}
		else{
			let currentValue=controlService.getCharacteristic(Characteristic.TargetTemperature).value
			this.log.debug('get amps', currentValue)
			//let currentAmps=Math.round(currentValue*1.8+32)
			if(currentValue>4.5){currentValue=4.44444}
			callback(null, currentValue)
		}
	} 

}

module.exports = control