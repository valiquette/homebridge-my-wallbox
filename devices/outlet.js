let packageJson=require('../package.json')
let wallboxAPI=require('../wallboxapi')

function basicOutlet (platform,log,config){
	this.log=log
	this.platform=platform
	this.wallboxapi=new wallboxAPI(this,log)
}

basicOutlet.prototype={

  createOutletService(device, type){
    this.log.debug('adding new outlet')
		let outletService=new Service.Outlet(type, device.id)
		let outletOn=false
		if(device.statusDescription=="Charging"){outletOn=true}
    outletService 
      .setCharacteristic(Characteristic.On, outletOn)
      .setCharacteristic(Characteristic.Name, type)
      .setCharacteristic(Characteristic.StatusFault,false)
    return outletService
  },

  configureOutletService(device, outletService){
    this.log.info("Configured %s outlet for %s" , outletService.getCharacteristic(Characteristic.Name).value, device.name)
    outletService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getOutletValue.bind(this, outletService))
      .on('set', this.setOutletValue.bind(this, device, outletService))
  },

  setOutletValue(device, outletService, value, callback){
		this.wallboxapi.getChargerData(this.platform.token,device.id).then(response=>{
			try{
				locked=response.data.data.chargerData.locked
				this.log.debug('check lock state = %s',locked)
			}catch(error){
				locked=true
				this.log.error("failed lock state check")
			}			
			if(!locked){
				this.log.debug('toggle outlet state %s',outletService.getCharacteristic(Characteristic.Name).value)
				if(outletService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
					callback('error')
				}
				else{
					if(value){
						this.wallboxapi.remoteAction(this.platform.token,device.id,'start').then(response=>{
							switch(response.status){
								case 200:
									outletService.getCharacteristic(Characteristic.On).updateValue(value)
									this.log.info('Resumed charging')
									break
								default:
									outletService.getCharacteristic(Characteristic.On).updateValue(!value)
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
									outletService.getCharacteristic(Characteristic.On).updateValue(value)
									this.log.info('Paused charging')
									break
								default:
									outletService.getCharacteristic(Characteristic.On).updateValue(!value)
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
				outletService.getCharacteristic(Characteristic.On).updateValue(!value)
				callback()
			}	
		})
		//this.platform.startLiveUpdate(device)
  },

	getOutletValue(outletService, callback){
		if(outletService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
			callback('error')
		}
		else{
			currentValue=outletService.getCharacteristic(Characteristic.On).value
			callback(null, currentValue)
		}
	} 

}

module.exports = basicOutlet