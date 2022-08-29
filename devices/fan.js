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
				locked=response.data.data.chargerData.locked
				this.log.debug('check lock state = %s',locked)
			}catch(error){
				locked=true
				this.log.error("failed lock state check")
			}			
			if(!locked){
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
								this.log.info('Failed to start charging')
								this.log.debug(response.data)
								break
							}
						})	
					callback()
				} 
			}
			else{
				this.log.info('Charger must be unlocked for this operation')
				fanService.getCharacteristic(Characteristic.On).updateValue(!value)
				callback()
			}	
		})
		//this.platform.startLiveUpdate(device)
	},

	setFanState(device, fanService, value, callback){
		this.wallboxapi.getChargerData(this.platform.token,device.id).then(response=>{
			try{
				locked=response.data.data.chargerData.locked
				this.log.debug('check lock state = %s',locked)
			}catch(error){
				locked=true
				this.log.error("failed lock state check")
			}			
			if(!locked){
				this.log.debug('toggle switch state %s',fanService.getCharacteristic(Characteristic.Name).value)
				if(fanService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
					callback('error')
				}
				else{
					if(value){
						this.wallboxapi.remoteAction(this.platform.token,device.id,'start').then(response=>{
							switch(response.status){
								case 200:
									fanService.getCharacteristic(Characteristic.On).updateValue(value)
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
									break
								default:
									fanService.getCharacteristic(Characteristic.On).updateValue(!value)
									this.log.info('Failed to pause charging %s',response.data.title)
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
				fanService.getCharacteristic(Characteristic.On).updateValue(!value)
				callback()
			}	
		})
		//this.platform.startLiveUpdate(device)
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