let packageJson=require('../package.json')
let wallboxAPI=require('../wallboxapi')

function light (platform,log,config){
	this.log=log
	this.platform=platform
	this.wallboxapi=new wallboxAPI(this,log)
}

light.prototype={

  createLightService(device, type){
    this.log.debug('adding new light')
		let currentAmps=device.maxChargingCurrent
		let switchOn=false
		if(device.statusDescription=="Charging"){switchOn=true}
		let lightService=new Service.Lightbulb(type, device.id)
    lightService 
      .setCharacteristic(Characteristic.Name, type)
      .setCharacteristic(Characteristic.StatusFault,false)
			.setCharacteristic(Characteristic.Brightness, currentAmps)
			.setCharacteristic(Characteristic.On, switchOn)
    return lightService
  },

  configureLightService(device, lightService){
		let min=6
		let max=40
		if(device.maxAvailableCurrent==48){max=48}
    this.log.info("Configured %s light for %s" , lightService.getCharacteristic(Characteristic.Name).value, device.name)
		lightService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getLightState.bind(this, lightService))
      .on('set', this.setLightState.bind(this, device, lightService))
		lightService
      .getCharacteristic(Characteristic.Brightness)
			.setProps({
					minStep:1,
					minValue:min,
					maxValue:max
			})
      .on('get', this.getLightAmps.bind(this, lightService))
      .on('set', this.setLightAmps.bind(this, device, lightService))
  },

	setLightAmps(device, lightService, value, callback){
		this.wallboxapi.getChargerData(this.platform.token,device.id).then(state=>{
			this.log.warn('check current state %s:%s',state.data.data.chargerData.status,state.data.data.chargerData.statusDescription)
			if(state.data.data.chargerData.status==( 161 || 181 || 194 || 209)){
			//if(state.data.data.chargerData.statusDescription==("Ready" || "Charging" || "Connected: waiting for car demand" || "Locked")){
				this.log.debug('set amps %s',lightService.getCharacteristic(Characteristic.Name).value)
				if(lightService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
					callback('error')
				}
				else{
					this.wallboxapi.setAmps(this.platform.token,device.id,value).then(response=>{
						switch(response.status){
							case 200:
								lightService.getCharacteristic(Characteristic.On).updateValue(value)
								break
							default:
								//lightService.getCharacteristic(Characteristic.On).updateValue(!value)
								this.log.info('Failed to start charging %s',response.data.title)
								this.log.debug(response.data)
								break
							}
						})	
					callback()
				} 
			}
			else{
				this.log.info('Unable to set amps at this time')
				//lightService.getCharacteristic(Characteristic.On).updateValue(!value)
				callback()
			}	
		})
	},

	setLightState(device, lightService, value, callback){
		this.wallboxapi.getChargerData(this.platform.token,device.id).then(state=>{
			this.log.warn('check current state %s:%s',state.data.data.chargerData.status,state.data.data.chargerData.statusDescription)
			if(state.data.data.chargerData.status==( 181 || 194 || 209)){
			//if(state.data.data.chargerData.statusDescription==("Ready" || "Charging" || "Connected: waiting for car demand" || "Locked")){
				this.log.debug('toggle switch state %s',lightService.getCharacteristic(Characteristic.Name).value)
				if(lightService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
					callback('error')
				}
				else{
					if(value){
						this.wallboxapi.remoteAction(this.platform.token,device.id,'start_charging').then(response=>{
							switch(response.status){
								case 200:
									lightService.getCharacteristic(Characteristic.On).updateValue(value)
									break
								default:
									lightService.getCharacteristic(Characteristic.On).updateValue(!value)
									this.log.info('Failed to start/stop charging %s',response.data.title)
									this.log.debug(response.data)
									break
								}
						})	
					} 
					else {
						this.wallboxapi.remoteAction(this.platform.token,device.id,'stop_charging').then(response=>{
							switch(response.status){
								case 200:
									lightService.getCharacteristic(Characteristic.On).updateValue(value)
									break
								default:
									lightService.getCharacteristic(Characteristic.On).updateValue(!value)
									this.log.info('Failed to stop charging %s',response.data.title)
									this.log.debug(response.data)
									break
								}
						})	
					}
					callback(value)
				} 
			}
			else{
				this.log.info('Unable to start at this time')
				lightService.getCharacteristic(Characteristic.On).updateValue(!value)
				callback(value)
			}	
		})
	},

	getLightState(lightService, callback){
		if(lightService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
			//callback('error')
		}
		else{
			let currentValue=lightService.getCharacteristic(Characteristic.On).value
			callback(null, currentValue)
		}
	}, 

	getLightAmps(lightService, callback){
		if(lightService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
			//callback('error')
		}
		else{
			let currentValue=lightService.getCharacteristic(Characteristic.Brightness).value
			callback(null, currentValue)
		}
	} 

}

module.exports = light