'use strict'
let wallboxAPI=require('./wallboxapi')
let lockMechanism=require('./devices/lock')
let battery=require('./devices/battery')
let basicSwitch=require('./devices/switch')
let light=require('./devices/light')
let control=require('./devices/control')

class wallboxPlatform {

  constructor(log, config, api){
    this.wallboxapi=new wallboxAPI(this ,log)
		this.lockMechanism=new lockMechanism(this, log)
		this.battery=new battery(this, log)
		this.basicSwitch=new basicSwitch(this, log, config)
		this.light=new light(this, log, config)
		this.control=new control(this, log, config)

    this.log=log
    this.config=config
    this.email=config.email
    this.password=config.password
    this.token
		this.refreshRate=config.refreshRate||30
		this.showControls=config.showControls
		this.id
    this.userId
		this.cars=config.cars
		this.voltage=240
		this.amperage=40
		this.locationName=config.locationName
		this.locationMatch
		this.accessories=[]
		this.amps=[]
		this.endTime=[]
    if(!config.email || !config.password){
      this.log.error('Valid email and password are required in order to communicate with wallbox, please check the plugin config')
    }
      this.log.info('Starting Wallbox Platform using homebridge API', api.version)
      if(api){
        this.api=api
        this.api.on("didFinishLaunching", function (){
          // Get devices
          this.getDevices()
        }.bind(this))
      }
    }

  identify (){
    this.log.info('Identify wallbox!')
  }

  getDevices(){
    this.log.debug('Fetching Build info...')
    this.log.info('Getting Account info...') 
		// login to the API and get the token
    this.wallboxapi.checkEmail(this.email).then(response=>{
      this.log.info('Email status %s',response.data.data.attributes.status)
			
			this.wallboxapi.signin(this.email,this.password).then(signin=>{
				this.log.debug('Found User ID %s',signin.data.data.attributes.user_id)
				this.log.debug('Found Token %s',signin.data.data.attributes.token)
				this.id=signin.data.data.attributes.user_id 
				this.token=signin.data.data.attributes.token 
				this.setTokenRefresh(signin.data.data.attributes.ttl)
				//get token
				this.wallboxapi.getId(this.token,this.id).then(userId=>{
					this.log.debug('Found User ID %s',userId.data.data.attributes.value)
					this.userId=userId.data.data.attributes.value
					//get groups
					this.wallboxapi.getChargerGroups(this.token).then(groups=>{
						this.log.debug('Found groups for %s ', groups.data.result.groups[0].name)
						//get user
						this.wallboxapi.getUser(this.token,this.userId).then(user=>{
							this.log.info('Found account for %s %s', user.data.data.name, user.data.data.surname)				
							user.data.data.accessConfigs.filter((accessConfig)=>{
								groups.data.result.groups.forEach((group)=>{
								if(!this.locationName || (this.locationName==group.name && accessConfig.group==group.id)){
								//if(!this.locationName || this.locationName==group.name){	
									this.log.info('Device found at the location: %s',group.name)
									this.locationMatch=true
								}	
								else{
									this.log.info('Skipping device at %s, not found at the configured location: %s',group.name,this.locationName)
									this.locationMatch=false
								}
								})
								return this.locationMatch
							}).forEach((accessConfig)=>{
								accessConfig.chargers.forEach((charger)=>{
									//loop each charger
									this.wallboxapi.getChargerData(this.token,charger).then(response=>{
										let chargerData=response.data.data.chargerData
										let uuid=UUIDGen.generate(chargerData.uid)							
										if(this.accessories[uuid]){
											this.api.unregisterPlatformAccessories(PluginName, PlatformName, [this.accessories[uuid]])
											delete this.accessories[uuid]
										}
										this.log.info('Adding Lock for %s charger ', chargerData.name)
										this.log.debug('Registering platform accessory')

										let lockAccessory=this.lockMechanism.createLockAccessory(chargerData,uuid)
										let lockService=this.lockMechanism.createLockService(chargerData)
										this.lockMechanism.configureLockService(lockService,chargerData.locked)
										lockAccessory.addService(lockService)
										
										let batteryService=this.battery.createBatteryService(chargerData)
										this.battery.configureBatteryService(batteryService)
										lockAccessory.getService(Service.LockMechanism).addLinkedService(batteryService)
										lockAccessory.addService(batteryService)
										this.amps[batteryService.subtype]=chargerData.maxChgCurrent

										if(this.showControls==3 || 4){
											let controlService=this.control.createControlService(chargerData,'Amps')
											this.control.configureControlService(chargerData, controlService)
											lockAccessory.getService(Service.LockMechanism).addLinkedService(controlService)
											lockAccessory.addService(controlService)
										}
										if(this.showControls==2 || 4){
											let lightService=this.light.createLightService(chargerData,'Start/Stop & Amps')
											this.light.configureLightService(chargerData, lightService)
											lockAccessory.getService(Service.LockMechanism).addLinkedService(lightService)
											lockAccessory.addService(lightService)
										}
										if(this.showControls==1 || 4){
											let switchService=this.basicSwitch.createSwitchService(chargerData,'Start/Pause')
											this.basicSwitch.configureSwitchService(chargerData, switchService)
											lockAccessory.getService(Service.LockMechanism).addLinkedService(switchService)
											lockAccessory.addService(switchService)
										}
										this.accessories[uuid]=lockAccessory                     
										this.api.registerPlatformAccessories(PluginName, PlatformName, [lockAccessory])
										this.setChargerRefresh(chargerData.id)
										this.updateStatus(chargerData.id)
									}).catch(err=>{this.log.error('Failed to get info for build', err)})
								})
							})
						}).catch(err=>{this.log.error('Failed to get info for build', err)})
					}).catch(err=>{this.log.error('Failed to get info for build', err)})
				}).catch(err=>{this.log.error('Failed to get info for build', err)})
    	}).catch(err=>{this.log.error('Failed to get info for build', err)})
		}).catch(err=>{this.log.error('Failed to get info for build', err)})
	}

	setTokenRefresh(ttl){
			// Refresh token every 14 days, before 15 day expiration
			if(ttl>Date.now()-3600000){
				setInterval(()=>{		
					try{		
						this.wallboxapi.signin(this.email,this.password).then(response=>{
							this.log.debug('refreshed token %s',response.data.data.attributes.token)
							this.token=response.data.data.attributes.token 	
							this.log.info('Token has been refreshed')
						}).catch(err=>{this.log.error('Failed signin to refresh token', err)})
					}catch(err){this.log.error('Failed to refresh token', err)}	
				//}, 14*24*60*60*1000)
				},ttl-Date.now()-3600000) // ~15 days -1 hour
			}
			else{
				this.log.warn('Unable to set refresh token interval')
			}
		}	

		setChargerRefresh(id){
			// Refresh charger status
				setInterval(()=>{		
					this.updateStatus(id)
				}, this.refreshRate*60*1000)
			}

			calcBattery(batteryService){
				if(this.cars){
					let car=this.cars.filter(charger=>(charger.chargerName.includes(batteryService.getCharacteristic(Characteristic.Name).value)))
					this.batterySize=car[0].kwH
				}
				else{
					this.batterySize=80
				}
				this.amperage=this.amps[batteryService.subtype]
				let kwh=this.voltage*this.amperage/1000 
				let fullCharge=(this.batterySize)/(kwh)
				let x=new Date(0,0)
				x.setSeconds(fullCharge*60*60)
				let fullChargeTime=x.toTimeString().slice(0,8)
				this.log.info('Charging time for 100% charge ',fullChargeTime)								
				let startTime= Date.now()
				let endTime=setInterval(()=>{		
						try{		
								let runningTime=Date.now()-startTime
								let chargeAdded=((this.amperage*this.voltage/1000)*(runningTime/60/60/1000)).toFixed(2)
								let percentAdded=(chargeAdded/this.batterySize*100).toFixed(2)
								//this.log.warn('Charge added %s kwh, %s%',chargeAdded,percentAdded)
								batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(percentAdded)
								if(percentAdded>100){
									clearInterval(endTime)
							}
						}catch(err){this.log.error('Failed', err)}	
				},1*60*1000)
				this.endTime[batteryService.subtype]=endTime
			}	

		async updateStatus(id){
			try{
				let status=this.wallboxapi.getChargerData(this.token,id).then(response=>{
					let chargerData=response.data.data.chargerData
					this.log.debug('refreshed charger %s',chargerData.id)
					let uuid=UUIDGen.generate(chargerData.uid)	
					let lockAccessory=this.accessories[uuid]
					let controlService	
					let lightService
					let switchService		
					let lockService
					let batteryService
					lockService=lockAccessory.getServiceById(Service.LockMechanism, chargerData.id)	
					batteryService=lockAccessory.getServiceById(Service.Battery, chargerData.id)	
					if(this.showControls==3 || 4){controlService=lockAccessory.getServiceById(Service.Thermostat, chargerData.id)}
					if(this.showControls==2 || 4){lightService=lockAccessory.getServiceById(Service.Lightbulb, chargerData.id)}
					if(this.showControls==1 || 4){switchService=lockAccessory.getServiceById(Service.Switch, chargerData.id)}		
					/*
					staus to statusDescription
					161: "Ready"
					194: "Charging"
					181: "Connected: waiting for car demand"
					209: "Locked"
					4: "Complete"
					5: "Offline"
					*/
					let stateOfCharge=0
					if(chargerData.stateOfCharge){stateOfCharge=chargerData.stateOfCharge}
					this.log.debug('Charger status %s',chargerData.statusDescription)
					switch(chargerData.statusDescription){
						case 'Ready':
							lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
							lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(false)
							lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(chargerData.locked)
							lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(chargerData.locked)
							if(this.showControls==3 || 4){controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(false)}
							if(this.showControls==2 || 4){lightService.getCharacteristic(Characteristic.On).updateValue(false)}
							if(this.showControls==1 || 4){switchService.getCharacteristic(Characteristic.On).updateValue(false)}
							batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING)
							//this.log.debug("Locked=%s, Outlet in use=%s, Charging=%s", false, chargerData.locked, false )
							break
						case 'Charging':
							lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
							lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(true)
							lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(chargerData.locked)
							lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(chargerData.locked)
							if(this.showControls==3 || 4){controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(true)}
							if(this.showControls==2 || 4){lightService.getCharacteristic(Characteristic.On).updateValue(true)}
							if(this.showControls==1 || 4){switchService.getCharacteristic(Characteristic.On).updateValue(true)}
							batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.CHARGING)
							this.calcBattery(batteryService)
							//this.log.debug("Locked=%s, Outlet in use=%s, Charging=%s", true, chargerData.locked, true )
							break	
						case 'Connected: waiting for car demand':
							lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
							lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(true)
							lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(chargerData.locked)
							lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(chargerData.locked)
							controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(false)
							if(this.showControls==3 || 4){controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(false)}
							if(this.showControls==2 || 4){lightService.getCharacteristic(Characteristic.On).updateValue(false)}
							if(this.showControls==1 || 4){switchService.getCharacteristic(Characteristic.On).updateValue(false)}
							batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING)
							//this.calcBattery(batteryService)
							clearInterval(this.endTime[batteryService.subtype])
							//this.log.debug("Locked=%s, Outlet in use=%s, Charging=%s", true, chargerData.locked, false )
							break	
						case 'Locked':
							lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
							lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(false)
							lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(chargerData.locked)
							lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.SECURED)
							if(this.showControls==3 || 4){controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(false)}
							if(this.showControls==2 || 4){lightService.getCharacteristic(Characteristic.On).updateValue(false)}
							if(this.showControls==1 || 4){switchService.getCharacteristic(Characteristic.On).updateValue(false)}
							batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING)
							this.log.debug("Locked=%s, Outlet in use=%s, Charging=%s", false, chargerData.locked, false )
							break
						case 'Complete':
							lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
							lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(false)
							lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(chargerData.locked)
							lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.SECURED)
							if(this.showControls==3 || 4){controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(false)}
							if(this.showControls==2 || 4){lightService.getCharacteristic(Characteristic.On).updateValue(false)}
							if(this.showControls==1 || 4){switchService.getCharacteristic(Characteristic.On).updateValue(false)}
							batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING)
							batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(stateOfCharge)
							this.log.info('%s completed at %s',chargerData.name, new Date().toLocaleString())
							//this.log.debug("Locked=%s, Outlet in use=%s, Charging=%s", true, chargerData.locked, false )
							break
						case 'Offline':
							lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.GENERAL_FAULT)
							this.log.warn('%s disconnected at %s! This will show as non-responding in Homekit until the connection is restored.',chargerData.name, new Date(chargerData.lastConnection*1000).toLocaleString())
							break
						default:
							this.log.warn('Unknown device message received: %s',chargerData.statusDescription)
							break	
					}		
					return chargerData
				}).then(chargerData=>{
					this.log.debug('returned current state = %s',chargerData.status)
					return chargerData.status
				})
				return status
			}catch(err) {this.log.error('Error updating status %s', err)}
		}	

  //**
  //** REQUIRED - Homebridge will call the "configureAccessory" method once for every cached accessory restored
  //**
  configureAccessory(accessory){
    // Added cached devices to the accessories arrary
    this.log.debug('Found cached accessory %s', accessory.displayName)
    this.accessories[accessory.UUID]=accessory
  }
  
}

module.exports=wallboxPlatform