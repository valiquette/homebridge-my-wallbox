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
				connected=response.data.data.chargerData.status
				this.log.debug('check connected state = %s',connected)
			}catch(error){
				connected=209
				this.log.error("failed connected state check")
			}	
			/*
			staus to statusDescription
			161: "Ready: Plug your car in"
			178: "Waiting: Waiting for car request from your car"
			181: "Connected: Waiting for car demand"
			182: "Paused: Press Play to resume charging"
			194: "Charging: Plugged and running"
			209: "Locked: Unlock to start session" no car
			210: "Locked: Unlock to start session" car connected
			4: "Complete"
			5: "Offline"
			*/	
			switch (connected){
				case 161: //no car
				case 209:
					this.log.info('Car must be connected for this operation')
					outletService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
				case 210: //car locked
					this.log.info('Charger must be unlocked for this operation')
					this.log.warn('Car Connected. Unlock charger to start session')
					outletService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
				case 181:
					this.log.info('Waiting for a charge request')
					outletService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
				case 178: //car unocked 
				case 182:	
				case 194:
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
										this.log.info('Charging resumed')
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
										this.log.info('Charging paused')
										break
									default:
										outletService.getCharacteristic(Characteristic.On).updateValue(!value)
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
					outletService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
			}
		})
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