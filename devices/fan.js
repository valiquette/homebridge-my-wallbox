let packageJson=require('../package.json')
let wallboxAPI=require('../wallboxapi')

function fan (platform,log,config){
	this.log=log
	this.platform=platform
	this.wallboxapi=new wallboxAPI(this,log)
}

fan.prototype={

  createFanService(device, type){
    this.log.debug('adding new fan')
		let currentAmps=device.maxChargingCurrent
		let switchOn=false
		if(device.statusDescription=="Charging"){switchOn=true}
		let fanService=new Service.Fan(type, device.id)
    fanService 
      .setCharacteristic(Characteristic.Name, type)
      .setCharacteristic(Characteristic.StatusFault,false)
			.setCharacteristic(Characteristic.RotationSpeed, currentAmps)
			.setCharacteristic(Characteristic.On, switchOn)
    return fanService
  },

  configureFanService(device, fanService){
		let min=6
		let max=device.maxAvailableCurrent || 40
    this.log.info("Configured %s fan for %s" , fanService.getCharacteristic(Characteristic.Name).value, device.name)
		fanService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getFanState.bind(this, fanService))
      .on('set', this.setFanState.bind(this, device, fanService))
		fanService
      .getCharacteristic(Characteristic.RotationSpeed)
			.setProps({
					minStep:1,
					minValue:min,
					maxValue:max
			})
      .on('get', this.getFanAmps.bind(this, fanService))
      .on('set', this.setFanAmps.bind(this, device, fanService))
  },

	setFanAmps(device, fanService, value, callback){
		this.wallboxapi.getChargerData(this.platform.token,device.id).then(response=>{
			try{
				connected=response.data.data.chargerData.status
				this.log.debug('check connected state = %s',connected)
			}catch(error){
				connected=209
				this.log.error("failed connected state check")
			}		
			switch (connected){
				case 161: //no car
				case 209:
					this.log.info('Car must be connected for this operation')
					fanService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
				case 210: //car locked
					this.log.info('Charger must be unlocked for this operation')
					this.log.warn('Car Connected. Unlock charger to start session')
					fanService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
				case 181:
					this.log.info('Waiting for a charge request')
					fanService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
				case 178: //car unocked 
				case 182:		
				case 194:
					this.log.debug('set amps %s',fanService.getCharacteristic(Characteristic.Name).value)
					if(fanService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
						callback('error')
					}
					else{
						this.wallboxapi.setAmps(this.platform.token,device.id,value).then(response=>{
							switch(response.status){
								case 200:
									fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(value)
									break
								default:
									fanService.getCharacteristic(Characteristic.On).updateValue(!value)
									this.log.info('Failed to change charging amps %s',response.data.title)
									this.log.debug(response.data)
									break
								}
							})	
						callback()
					} 
					break
				default:
					this.log.info('This opertation cannot be competed at this time')
					fanService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
			}
		})
  },
			
	setFanState(device, fanService, value, callback){
		this.wallboxapi.getChargerData(this.platform.token,device.id).then(response=>{
			try{
				connected=response.data.data.chargerData.status
				this.log.debug('check connected state = %s',connected)
			}catch(error){
				connected=209
				this.log.error("failed connected state check")
			}
			switch (connected){
				case 161: //no car
				case 209:
					this.log.info('Car must be connected for this operation')
					fanService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
				case 210: //car locked
					this.log.info('Charger must be unlocked for this operation')
					this.log.warn('Car Connected. Unlock charger to start session')
					fanService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
				case 181:
					this.log.info('Waiting for a charge request')
					fanService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
				case 178: //car unocked 
				case 182:	
				case 194:
					this.log.debug('toggle outlet state %s',fanService.getCharacteristic(Characteristic.Name).value)
					if(fanService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
						callback('error')
					}
					else{
						if(value){
							this.wallboxapi.remoteAction(this.platform.token,device.id,'start').then(response=>{
								switch(response.status){
									case 200:
										fanService.getCharacteristic(Characteristic.On).updateValue(value)
										this.log.info('Charging resumed')
										break
									default:
										fanService.getCharacteristic(Characteristic.On).updateValue(!value)
										this.log.info('Failed to start charging')
										this.log.debug(response.data)
										break
								}
							})	
						} 
						else {
							this.wallboxapi.remoteAction(this.platform.token,device.id,'pause').then(response=>{
								switch(response.status){
									case 200:
										fanService.getCharacteristic(Characteristic.On).updateValue(value)
										this.log.info('Charging paused')
										break
									default:
										fanService.getCharacteristic(Characteristic.On).updateValue(!value)
										this.log.info('Failed to stop charging')
										this.log.debug(response.data)
										break
								}
							})	
						}
					}	
					callback()
					break
				default:
					this.log.info('This opertation cannot be competed at this time')
					fanService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
			}
		})
  },
			
	getFanState(fanService, callback){
		if(fanService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
			callback('error')
		}
		else{
			let currentValue=fanService.getCharacteristic(Characteristic.On).value
			callback(null, currentValue)
		}
	}, 

	getFanAmps(fanService, callback){
		if(fanService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
			callback('error')
		}
		else{
			let currentValue=fanService.getCharacteristic(Characteristic.RotationSpeed).value
			callback(null, currentValue)
		}
	} 

}

module.exports = fan