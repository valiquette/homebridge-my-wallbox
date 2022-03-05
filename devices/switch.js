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
		this.wallboxapi.getChargerData(this.platform.token,device.id).then(state=>{
			this.log.warn('check current state %s:%s',state.data.data.chargerData.status,state.data.data.chargerData.statusDescription)
			if(state.data.data.chargerData.status==( 181 || 194 || 209)){
			//if(state.data.data.chargerData.statusDescription==("Ready" || "Charging" || "Connected: waiting for car demand" || "Locked")){
				this.log.warn('toggle switch state %s',switchService.getCharacteristic(Characteristic.Name).value)
				if(switchService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
					callback('error')
				}
				else{
					if(value){
						this.wallboxapi.remoteAction(this.platform.token,device.id,'start_charging').then(response=>{
							switch(response.status){
								case 200:
									switchService.getCharacteristic(Characteristic.On).updateValue(value)
									break
								default:
									switchService.getCharacteristic(Characteristic.On).updateValue(!value)
									this.log.info('Failed to start charging %s',response.data.title)
									this.log.debug(response.data)
									break
								}
						})	
					} 
					else {
						this.wallboxapi.remoteAction(this.platform.token,device.id,'stop_charging').then(response=>{
							switch(response.status){
								case 200:
									switchService.getCharacteristic(Characteristic.On).updateValue(value)
									break
								default:
									switchService.getCharacteristic(Characteristic.On).updateValue(!value)
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
				this.log.info('Unable to start/stop at this time')
				switchService.getCharacteristic(Characteristic.On).updateValue(!value)
				callback(value)
			}	
		})
  },

	getSwitchValue(switchService, callback){
		//this.log.debug("%s=%s", switchService.getCharacteristic(Characteristic.Name).value,switchService.getCharacteristic(Characteristic.On).value)
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