'use strict'
let wallboxAPI=require('./wallboxapi')
let lockMechanism=require('./devices/lock')
let battery=require('./devices/battery')
let basicSwitch=require('./devices/switch')
let outlet=require('./devices/outlet')
let control=require('./devices/control')
let enumeration=require('./enumerations')

class wallboxPlatform {

  constructor(log, config, api){
    this.wallboxapi=new wallboxAPI(this ,log)
		this.lockMechanism=new lockMechanism(this, log)
		this.battery=new battery(this, log)
		this.basicSwitch=new basicSwitch(this, log, config)
		this.outlet=new outlet(this, log, config)
		this.control=new control(this, log, config)
		this.enumeration=enumeration

    this.log=log
    this.config=config
    this.email=config.email
    this.password=config.password
    this.token
		this.retryWait=config.retryWait || 30 //sec
		this.refreshRate=config.refreshRate || 24 //hour
		this.liveTimeout=config.liveRefreshTimeout || 2 //min
		this.liveRefresh=config.liveRefreshRate || 20 //sec
		this.lastInterval
		this.apiCount=0
		this.liveUpdate=false
		this.showBattery=false
		this.showControls=config.showControls
		this.useFahrenheit=config.useFahrenheit || true
		this.id
    this.userId
		this.cars=config.cars
		this.locationName=config.locationName
		this.locationMatch
		this.accessories=[]
		this.amps=[]
		this.endTime=[]
		if(this.showControls==8){
			this.showControls=4
			this.useFahrenheit=false
		}
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
			// get signin & token
			let signin=await this.wallboxapi.signin(this.email,this.password).catch(err=>{this.log.error('Failed to get signin for build', err)})
			this.log.debug('Found User ID %s',signin.data.data.attributes.user_id)
			this.log.debug('Found Token %s',signin.data.data.attributes.token)
			this.id=signin.data.data.attributes.user_id
			this.token=signin.data.data.attributes.token
			//this.setTokenRefresh(signin.data.data.attributes.ttl-Date.now())
			//this.log.warn(new Date(signin.data.data.attributes.ttl).toLocaleString())
			//this.log.warn(new Date(Date.now()).toLocaleString())

			//get get user id
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
				accessConfig.chargers.forEach(async(charger)=>{
					//loop each charger
					let chargerDataResponse=await this.wallboxapi.getChargerData(this.token,charger).catch(err=>{this.log.error('Failed to get charger configs for build', err)})
					let chargerData=chargerDataResponse.data.data.chargerData
					let uuid=UUIDGen.generate(chargerData.uid)
					if(this.accessories[uuid]){
						this.api.unregisterPlatformAccessories(PluginName, PlatformName, [this.accessories[uuid]])
						delete this.accessories[uuid]
					}
					this.log.info('Adding Lock for %s charger ', chargerData.name)
					this.log.debug('Registering platform accessory')

					let lockAccessory=this.lockMechanism.createLockAccessory(chargerData,uuid)
					let lockService=this.lockMechanism.createLockService(chargerData)
					this.lockMechanism.configureLockService(chargerData, lockService)
					lockAccessory.addService(lockService)

					if(this.showBattery){
						let batteryService=this.battery.createBatteryService(chargerData)
						this.battery.configureBatteryService(batteryService)
						lockAccessory.getService(Service.LockMechanism).addLinkedService(batteryService)
						lockAccessory.addService(batteryService)
						this.amps[batteryService.subtype]=chargerData.maxChgCurrent
					}
					if(this.showControls==5 || this.showControls==4){
						let outletService=this.outlet.createOutletService(chargerData,'Start/Pause')
						this.outlet.configureOutletService(chargerData, outletService)
						lockAccessory.getService(Service.LockMechanism).addLinkedService(outletService)
						lockAccessory.addService(outletService)
					}
					if(this.showControls==3 || this.showControls==4){
						let controlService=this.control.createControlService(chargerData,'Amps')
						this.control.configureControlService(chargerData, controlService)
						lockAccessory.getService(Service.LockMechanism).addLinkedService(controlService)
						lockAccessory.addService(controlService)
					}
					if(this.showControls==1 || this.showControls==4){
						let switchService=this.basicSwitch.createSwitchService(chargerData,'Start/Pause')
						this.basicSwitch.configureSwitchService(chargerData, switchService)
						lockAccessory.getService(Service.LockMechanism).addLinkedService(switchService)
						lockAccessory.addService(switchService)
					}
					this.accessories[uuid]=lockAccessory
					this.api.registerPlatformAccessories(PluginName, PlatformName, [lockAccessory])
					this.setChargerRefresh(chargerData)
					this.getStatus(chargerData.id)
				})
			})
			setTimeout(()=>{this.log.info('Wallbox Platform finished loading')}, 500)
		}catch(err){
			this.log.error('Failed to get devices...%s \nRetrying in %s seconds...', err,this.retryWait)
			setTimeout(async()=>{
				this.getDevices()
			},this.retryWait*1000)
		}
	}

	setTokenRefresh(ttl){ //stopped calling on start due to token ttl changes
			if(ttl>3600000){
				setInterval(async()=>{
					try{
						let signin=await this.wallboxapi.signin(this.email,this.password).catch(err=>{this.log.error('Failed to refresh token', err)})
						this.log.debug('refreshed token %s',signin.data.data.attributes.token)
						this.token=signin.data.data.attributes.token
						this.log.info('Token has been refreshed')
					}catch(err){this.log.error('Failed to refresh token', err)}
				},ttl) // ~was 15 days then 15 mins now 1 day
			}
			else{
				this.log.warn('Unable to set refresh token interval')
			}
		}

	setChargerRefresh(device){
		// Refresh charger status
			setInterval(async()=>{
				this.log('API polling update calls for this polling period %s',this.apiCount)
				this.apiCount=0
				this.getStatus(device.id)
			}, this.refreshRate*60*60*1000)
		}

	async startLiveUpdate(device){
		clearInterval(this.lastInterval)
		//get new token
		let signin=await this.wallboxapi.signin(this.email,this.password).catch(err=>{this.log.error('Failed to refresh token', err)})
		this.token=signin.data.data.attributes.token
		let startTime = new Date().getTime() //live refresh
		if(!this.liveUpdate){this.log.debug("live update started")}
		this.liveUpdate=true
			let interval = setInterval(async()=>{
				this.lastInterval-interval
					if(new Date().getTime() - startTime > this.liveTimeout*60*1000){
						clearInterval(interval)
						this.liveUpdate=false
						this.log.debug("live update stopped")
						return
					}
					this.apiCount=this.apiCount+1
					this.log.debug('API get count %s',this.apiCount)
				this.getStatus(device.id)
			}, this.liveRefresh*1000)
		this.lastInterval=interval
	}

	calcBattery(batteryService,energyAdded,chargingTime){
		if(this.cars){
			let car=this.cars.filter(charger=>(charger.chargerName.includes(batteryService.getCharacteristic(Characteristic.Name).value)))
			this.batterySize=car[0].kwH
		}
		else{
			this.batterySize=80
		}
		let hours = Math.floor(chargingTime / 60 / 60)
		let minutes = Math.floor(chargingTime / 60) - (hours * 60)
		let seconds = chargingTime % 60
		let percentAdded=Math.round(energyAdded/this.batterySize*100)
		this.log.debug('Charging time %s hours %s minutes, charge added %s kWh, %s%',hours,minutes,energyAdded,percentAdded)
		return percentAdded
	}

	async	getStatus(id){
	try{
		let statusResponse=await this.wallboxapi.getChargerStatus(this.token,id).catch(err=>{this.log.error(err)})
			if(statusResponse){
				this.updateStatus(statusResponse.data)
			}
		}catch(err) {this.log.error('Error updating status %s', err)}
	}

	async updateStatus(charger){
		try{
			let chargerID=charger.config_data.charger_id
			let chargerUID=charger.config_data.uid
			let locked=charger.config_data.locked
			let maxAmps=charger.config_data.max_charging_current
			let chargerName=charger.name
			let statusID=charger.status_id
			let added_kWh=charger.added_energy
			let chargingTime=charger.charging_time

			this.log.debug('Updating charger ID %s',chargerID)
			let uuid=UUIDGen.generate(chargerUID)
			let lockAccessory=this.accessories[uuid]
			let controlService
			let switchService
			let outletService
			let lockService
			let batteryService
			let statusInfo
			lockService=lockAccessory.getServiceById(Service.LockMechanism, chargerID)
			if(this.showBattery){batteryService=lockAccessory.getServiceById(Service.Battery, chargerID)}
			if(this.showControls==5 || this.showControls==4){outletService=lockAccessory.getServiceById(Service.Outlet, chargerID)}
			if(this.showControls==3 || this.showControls==4){controlService=lockAccessory.getServiceById(Service.Thermostat, chargerID)}
			if(this.showControls==1 || this.showControls==4){switchService=lockAccessory.getServiceById(Service.Switch, chargerID)}

			/****
			enumerations will contain list of known status and descriptions
			text is base on web, altText is based on app
			statusDescipton is base on observered response or past API statusDescription
			****/

			try {
				statusInfo=this.enumeration.items.filter(result=>result.status == statusID)[0]
				this.log.debug('Refreshed charger with status=%s %s - %s. %s.',statusID,statusInfo.statusDescription,statusInfo.text,statusInfo.altText)
			}catch(err) {
				statusInfo.mode="unknown"
			}
			switch(statusInfo.mode){
				case 'lockedMode':
				case 'readyMode':
					lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
					if(charger.statusID==210){
						lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(true)
					}
					else{
						lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(false)
					}
					lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(locked)
					lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(locked)
					if(this.showControls==5 || this.showControls==4){outletService.getCharacteristic(Characteristic.On).updateValue(false)}
					if(this.showControls==3 || this.showControls==4){
						controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(false)
						controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(false)
						if(this.useFahrenheit){
							controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(((maxAmps-32+.01)*5/9).toFixed(2))
							controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(((maxAmps-32+.01)*5/9).toFixed(2))
						}
						else{
							controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(maxAmps)
							controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(maxAmps)
						}
					}
					if(this.showControls==1 || this.showControls==4){switchService.getCharacteristic(Characteristic.On).updateValue(false)}
					if(this.showBattery){
						batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING)
						batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(this.calcBattery(batteryService,added_kWh,chargingTime))
					}
					break
				case 'chargingMode':
					lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
					lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(true)
					lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(locked)
					lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(locked)
					if(this.showControls==5 || this.showControls==4){outletService.getCharacteristic(Characteristic.On).updateValue(true)}
					if(this.showControls==3 || this.showControls==4){
						controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(true)
						controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(true)
						if(this.useFahrenheit){
							controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(((maxAmps-32+.01)*5/9).toFixed(2))
							controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(((maxAmps-32+.01)*5/9).toFixed(2))
						}
						else{
							controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(maxAmps)
							controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(maxAmps)
						}
					}
					if(this.showControls==1 || this.showControls==4){switchService.getCharacteristic(Characteristic.On).updateValue(true)}
					if(this.showBattery){
						batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.CHARGING)
						batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(this.calcBattery(batteryService,added_kWh,chargingTime))
					}
					break
				case 'standbyMode':
					lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
					lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(true)
					lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(locked)
					lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(locked)
					if(this.showControls==5 || this.showControls==4){outletService.getCharacteristic(Characteristic.On).updateValue(false)}
					if(this.showControls==3 || this.showControls==4){
						controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(false)
						controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(false)
						if(this.useFahrenheit){
							controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(((maxAmps-32+.01)*5/9).toFixed(2))
							controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(((maxAmps-32+.01)*5/9).toFixed(2))
						}
						else{
							controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(maxAmps)
							controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(maxAmps)
						}
					}
					if(this.showControls==1 || this.showControls==4){switchService.getCharacteristic(Characteristic.On).updateValue(false)}
					if(this.showBattery){
						batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING)
						batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(this.calcBattery(batteryService,added_kWh,chargingTime))
					}
					if(statusID==4){
						this.log.info('%s completed at %s',chargerName, new Date().toLocaleString())
					}
					break
				case 'firmwareUpdate':
				case 'errorMode':
					lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.GENERAL_FAULT)
					switch(statusID){
						case 166: //Updating':
							this.log.Info('%s updating...',chargerName)
							break
						case 14: //error':
						case 15:
							this.log.error('%s threw an error at %s!',chargerName, Date().toLocaleString())
							break
						case 5: //Offline':
							this.log.warn('%s charger offline at %s! This will show as non-responding in Homekit until the connection is restored.',chargerName, new Date(charger.config_data.sync_timestamp*1000).toLocaleString())
							break
						case 0: //'Dissconnected':
							this.log.warn('%s disconnected at %s! This will show as non-responding in Homekit until the connection is restored.',chargerName, new Date(charger.config_data.sync_timestamp*1000).toLocaleString())
							break
					}
					break
				default:
					this.log.warn('Unknown device status received: %s: %s',statusID)
					break
			}
			return charger
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