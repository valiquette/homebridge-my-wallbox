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
				locked=response.data.data.chargerData.locked
				this.log.debug('check lock state = %s',locked)
			}catch(error){
				locked=true
				this.log.error("failed lock state check")
			}			
			if(!locked){
				this.log.debug('toggle switch state %s',switchService.getCharacteristic(Characteristic.Name).value)
				if(switchService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
					callback('error')
				}
				else{
					if(value){
						this.wallboxapi.remoteAction(this.platform.token,device.id,'start').then(response=>{
							switch(response.status){
								case 200:
									switchService.getCharacteristic(Characteristic.On).updateValue(value)
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
									break
								default:
									switchService.getCharacteristic(Characteristic.On).updateValue(!value)
									this.log.info('Failed to stop charging')
									this.log.debug(response.data)
									break
								}
						})	
					}
					callback()
				} 
			}
			else{
				this.log.info('Charger must be unlocked for this operation')
				switchService.getCharacteristic(Characteristic.On).updateValue(!value)
				callback()
			}	
		})
		//this.platform.startLiveUpdate(device)
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