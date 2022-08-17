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
		this.showBattery=config.showBattery
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
		if(config.cars){this.showBattery=true}
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

  async getDevices(){
		try{
			this.log.debug('Fetching Build info...')
			this.log.info('Getting Account info...') 
			// login to the API and get the token
			let email=await this.wallboxapi.checkEmail(this.email).catch(err=>{this.log.error('Failed to get email for build', err)})
			this.log.info('Email status %s',email.data.data.attributes.status)
			// get signin
			let signin=await this.wallboxapi.signin(this.email,this.password).catch(err=>{this.log.error('Failed to get signin for build', err)})
			this.log.debug('Found User ID %s',signin.data.data.attributes.user_id)
			this.log.debug('Found Token %s',signin.data.data.attributes.token)
			this.id=signin.data.data.attributes.user_id 
			this.token=signin.data.data.attributes.token 
			this.setTokenRefresh(signin.data.data.attributes.ttl)
			//get token
			let userId=await this.wallboxapi.getId(this.token,this.id).catch(err=>{this.log.error('Failed to get userId for build', err)})
			this.log.debug('Found User ID %s',userId.data.data.attributes.value)
			this.userId=userId.data.data.attributes.value
			//get groups
			let groups=await this.wallboxapi.getChargerGroups(this.token).catch(err=>{this.log.error('Failed to get groups for build', err)})
			groups.data.result.groups.forEach((group)=>{
				this.log.info('Found group for %s ', group.name)
				group.chargers.forEach((charger)=>{
					this.log.info('Found %s with software %s',charger.name, charger.software.currentVersion)
					if(charger.software.updateAvailable){
						this.log.warn('%s software update %s is available',charger.name, charger.software.latestVersion)
					}
				})
			})
			//get user
			let user=await this.wallboxapi.getUser(this.token,this.userId).catch(err=>{this.log.error('Failed to get user for build', err)})
			this.log.info('Found account for %s %s', user.data.data.name, user.data.data.surname)				
			user.data.data.accessConfigs.filter((accessConfig)=>{
				groups.data.result.groups.forEach((group)=>{
				if(!this.locationName || (this.locationName==group.name && accessConfig.group==group.id)){	
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
						
						if(this.showBattery){
							let batteryService=this.battery.createBatteryService(chargerData)
							this.battery.configureBatteryService(batteryService)
							lockAccessory.getService(Service.LockMechanism).addLinkedService(batteryService)
							lockAccessory.addService(batteryService)
							this.amps[batteryService.subtype]=chargerData.maxChgCurrent
						}
						if(this.showControls==3 || this.showControls==4){
							let controlService=this.control.createControlService(chargerData,'Amps')
							this.control.configureControlService(chargerData, controlService)
							lockAccessory.getService(Service.LockMechanism).addLinkedService(controlService)
							lockAccessory.addService(controlService)
						}
						if(this.showControls==2 || this.showControls==4){
							let lightService=this.light.createLightService(chargerData,'Start/Stop & Amps')
							this.light.configureLightService(chargerData, lightService)
							lockAccessory.getService(Service.LockMechanism).addLinkedService(lightService)
							lockAccessory.addService(lightService)
						}
						if(this.showControls==1 || this.showControls==4){
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
		}catch(err){
			this.log.error('Failed to get devices...%s \nRetrying in 15 seconds...', err)
			setTimeout(async()=>{
				this.getDevices()
			},15*1000)
		}	
	}

	async setTokenRefresh(ttl){
			// Refresh token every 14 days, before 15 day expiration
			if(ttl>Date.now()-3600000){
				setInterval(async()=>{		
					try{		
						//this.wallboxapi.signin(this.email,this.password).then(signin=>{
							let signin=await this.wallboxapi.signin(this.email,this.password) 
							this.log.debug('refreshed token %s',signin.data.data.attributes.token)
							this.token=signin.data.data.attributes.token 	
							this.log.info('Token has been refreshed')
						//}).catch(err=>{this.log.error('Failed signin to refresh token', err)})
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
					if(this.showBattery){batteryService=lockAccessory.getServiceById(Service.Battery, chargerData.id)}	
					if(this.showControls==3 || this.showControls==4){controlService=lockAccessory.getServiceById(Service.Thermostat, chargerData.id)}
					if(this.showControls==2 || this.showControls==4){lightService=lockAccessory.getServiceById(Service.Lightbulb, chargerData.id)}
					if(this.showControls==1 || this.showControls==4){switchService=lockAccessory.getServiceById(Service.Switch, chargerData.id)}		
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
					switch(chargerData.status){
						case 161: //'Ready':
							lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
							lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(false)
							lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(chargerData.locked)
							lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(chargerData.locked)
							if(this.showControls==3 || this.showControls==4){controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(false)}
							if(this.showControls==2 || this.showControls==4){lightService.getCharacteristic(Characteristic.On).updateValue(false)}
							if(this.showControls==1 || this.showControls==4){switchService.getCharacteristic(Characteristic.On).updateValue(false)}
							if(this.showBattery){batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING)}
							break
						case 194: //'Charging':
							lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
							lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(true)
							lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(chargerData.locked)
							lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(chargerData.locked)
							if(this.showControls==3 || this.showControls==4){controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(true)}
							if(this.showControls==2 || this.showControls==4){lightService.getCharacteristic(Characteristic.On).updateValue(true)}
							if(this.showControls==1 || this.showControls==4){switchService.getCharacteristic(Characteristic.On).updateValue(true)}
							if(this.showBattery){batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.CHARGING)}
							if(this.showBattery){this.calcBattery(batteryService)}
							break	
						case 209: //'Locked':
							lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
							lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(false)
							lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(chargerData.locked)
							lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.SECURED)
							if(this.showControls==3 || this.showControls==4){controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(false)}
							if(this.showControls==2 || this.showControls==4){lightService.getCharacteristic(Characteristic.On).updateValue(false)}
							if(this.showControls==1 || this.showControls==4){switchService.getCharacteristic(Characteristic.On).updateValue(false)}
							if(this.showBattery){batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING)}
							break
						case 4: //'Complete':
							lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
							lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(false)
							lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(chargerData.locked)
							lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.SECURED)
							if(this.showControls==3 || this.showControls==4){controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(false)}
							if(this.showControls==2 || this.showControls==4){lightService.getCharacteristic(Characteristic.On).updateValue(false)}
							if(this.showControls==1 || this.showControls==4){switchService.getCharacteristic(Characteristic.On).updateValue(false)}
							if(this.showBattery){batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING)}
							if(this.showBattery){batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(stateOfCharge)}
							this.log.info('%s completed at %s',chargerData.name, new Date().toLocaleString())
							break
						case 5: //Offline':
							lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.GENERAL_FAULT)
							this.log.warn('%s disconnected at %s! This will show as non-responding in Homekit until the connection is restored.',chargerData.name, new Date(chargerData.lastConnection*1000).toLocaleString())
							break
						case 0: //'Dissconnected':
							lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.GENERAL_FAULT)
							this.log.warn('%s disconnected at %s! This will show as non-responding in Homekit until the connection is restored.',chargerData.name, new Date(chargerData.lastConnection*1000).toLocaleString())
							break
						default:
							this.log.warn('Unknown device message received: %s: %s',chargerData.status, chargerData.statusDescription)
							break	
					}		
					return chargerData
				}).then(chargerData=>{
					this.log.debug('returned current state = %s: description %s',chargerData.status, chargerData.statusDescription)
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