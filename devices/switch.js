let packageJson=require('../package.json')
let wallboxAPI=require('../wallboxapi')

function basicSwitch (platform,log,config){
	this.log=log
	this.platform=platform
	this.wallboxapi=new wallboxAPI(this,log)
}

basicSwitch.prototype={

  createSwitchService(device, type){
    this.log.debug('adding new switch')
		let switchService=new Service.Switch(type, device.id)
		let switchOn=false
		if(device.statusDescription=="Charging"){switchOn=true}
    switchService 
      .setCharacteristic(Characteristic.On, switchOn)
      .setCharacteristic(Characteristic.Name, type)
      .setCharacteristic(Characteristic.StatusFault,false)
    return switchService
  },

  configureSwitchService(device, switchService){
    this.log.info("Configured %s switch for %s" , switchService.getCharacteristic(Characteristic.Name).value, device.name)
    switchService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getSwitchValue.bind(this, switchService))
      .on('set', this.setSwitchValue.bind(this, device, switchService))
  },
	
  setSwitchValue(device, switchService, value, callback){
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
					switchService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
				case 210: //car locked
					this.log.info('Charger must be unlocked for this operation')
					this.log.warn('Car Connected. Unlock charger to start session')
					switchService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
				case 181:
					this.log.info('Waiting for a charge request')
					switchService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
				case 178: //car unocked 
				case 182:	
				case 194:
					this.log.debug('toggle outlet state %s',switchService.getCharacteristic(Characteristic.Name).value)
					if(switchService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
						callback('error')
					}
					else{
						if(value){
							this.wallboxapi.remoteAction(this.platform.token,device.id,'start').then(response=>{
								switch(response.status){
									case 200:
										switchService.getCharacteristic(Characteristic.On).updateValue(value)
										this.log.info('Charging resumed')
										break
									default:
										switchService.getCharacteristic(Characteristic.On).updateValue(!value)
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
										switchService.getCharacteristic(Characteristic.On).updateValue(value)
										this.log.info('Charging paused')
										break
									default:
										switchService.getCharacteristic(Characteristic.On).updateValue(!value)
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
					switchService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
			}
		})
  },

	getSwitchValue(switchService, callback){
		if(switchService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
			callback('error')
		}
		else{
			currentValue=switchService.getCharacteristic(Characteristic.On).value
			callback(null, currentValue)
		}
	} 

}

module.exports = basicSwitch