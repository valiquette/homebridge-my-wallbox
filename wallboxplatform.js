'use strict'
let wallboxAPI=require('./wallboxapi')
let lockMechanism=require('./devices/lock')
let battery=require('./devices/battery')
let sensor=require('./devices/sensor')
let basicSwitch=require('./devices/switch')
let outlet=require('./devices/outlet')
let control=require('./devices/control')
let enumeration=require('./enumerations')

class wallboxPlatform {

	constructor(log, config, api){
		this.wallboxapi=new wallboxAPI(this, log)
		this.lockMechanism=new lockMechanism(this, log)
		this.battery=new battery(this, log)
		this.sensor=new sensor(this, log)
		this.basicSwitch=new basicSwitch(this, log, config)
		this.outlet=new outlet(this, log, config)
		this.control=new control(this, log, config)
		this.enumeration=enumeration

		this.log=log
		this.config=config
		this.email=config.email
		this.password=config.password
		this.token
		this.refreshToken
		this.retryWait=config.retryWait || 60 //sec
		this.retryMax=config.retryMax || 3 //attempts
		this.retryAttempt=0
		this.refreshRate=config.refreshRate || 24 //hour
		this.liveTimeout=config.liveRefreshTimeout || 2 //min
		this.liveRefresh=config.liveRefreshRate || 20 //sec
		this.lastInterval
		this.apiCount=0
		this.liveUpdate=false
		this.showBattery=config.cars ? true : false
		this.showSensor=config.socSensor ? config.socSensor : false
		this.showControls=config.showControls
		this.useFahrenheit=config.useFahrenheit ? config.useFahrenheit : true
		this.showAPIMessages=config.showAPIMessages ? config.showAPIMessages : false
		this.showUserMessages=config.showUserMessages ? config.showUserMessages : false
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
		if(!config.email || !config.password){
		this.log.error('Valid email and password are required in order to communicate with wallbox, please check the plugin config')
		}
		this.log.info('Starting Wallbox platform using homebridge API', api.version)
		if(api){
			this.api=api
			this.api.on("didFinishLaunching", function (){
				// Get devices
				this.getDevices()
			}.bind(this))
		}
		}

	identify(){
		this.log.info('Identify wallbox!')
	}

	async getDevices(){
		try{
			this.log.debug('Fetching Build info...')
			this.log.info('Getting Account info...')
			// login to the API and get the token
			let email=await this.wallboxapi.checkEmail(this.email).catch(err=>{this.log.error('Failed to get email for build. \n%s', err)})
			this.log.info('Email status %s', email.data.attributes.status)
			if( email.data.attributes.status!="confirmed"){
				return
			}
			// get signin & token
			let signin=await this.wallboxapi.signin(this.email, this.password).catch(err=>{this.log.error('Failed to get signin for build. \n%s', err)})
			this.log.debug('Found user ID %s', signin.data.attributes.user_id)
			//this.log.debug('Found token %s', signin.data.attributes.token)
			this.log.debug('Found token  %s********************%s', signin.data.attributes.token.substring(0,35),signin.data.attributes.token.substring((signin.data.attributes.token).length-35))
			this.id=signin.data.attributes.user_id
			this.token=signin.data.attributes.token
			this.refreshToken=signin.data.attributes.refresh_token
			if(this.showUserMessages){
				this.log.info('Current time ',new Date(Date.now()).toLocaleString())
				this.log.info('Token will expire on %s, %s minutes ',new Date(signin.data.attributes.ttl).toLocaleString(), Math.round((signin.data.attributes.ttl-Date.now())/60/1000))
				this.log.info('Refresh Token will expire on %s, %s days ',new Date(signin.data.attributes.refresh_token_ttl).toLocaleString(), Math.round((signin.data.attributes.refresh_token_ttl-Date.now())/24/60/60/1000))
				}
			else{
				this.log.debug('Current time ',new Date(Date.now()).toLocaleString())
				this.log.debug('Token will expire on %s, %s minutes ',new Date(signin.data.attributes.ttl).toLocaleString(), Math.round((signin.data.attributes.ttl-Date.now())/60/1000))
				this.log.debug('Refresh Token will expire on %s, %s days ',new Date(signin.data.attributes.refresh_token_ttl).toLocaleString(), Math.round((signin.data.attributes.refresh_token_ttl-Date.now())/24/60/60/1000))
				}
			//this.setTokenRefresh(signin.data.attributes.ttl) //disabled for new ondemand method
			//get get user id
			let userId=await this.wallboxapi.getId(this.token, this.id).catch(err=>{this.log.error('Failed to get userId for build. \n%s', err)})
			this.log.debug('Found user ID %s', userId.data.attributes.value)
			this.userId=userId.data.attributes.value
			//get groups
			let groups=await this.wallboxapi.getChargerGroups(this.token).catch(err=>{this.log.error('Failed to get groups for build. \n%s', err)})
			groups.result.groups.forEach((group)=>{
				this.log.info('Found group for %s ', group.name)
				group.chargers.forEach((charger)=>{
					this.log.info('Found charger %s with software %s',charger.name, charger.software.currentVersion)
					if(charger.software.updateAvailable){
						this.log.warn('%s software update %s is available',charger.name, charger.software.latestVersion)
					}
				})
			})
			//get user
			let user=await this.wallboxapi.getUser(this.token, this.userId).catch(err=>{this.log.error('Failed to get user for build. \n%s', err)})
			this.log.info('Found account for %s %s', user.data.name, user.data.surname)
			user.data.accessConfigs.filter((accessConfig)=>{
				groups.result.groups.forEach((group)=>{
				if(!this.locationName || (this.locationName==group.name && accessConfig.group==group.id)){
					this.log.info('Found device at the location: %s',group.name)
					this.locationMatch=true
				}
				else{
					this.log.info('Skipping device at %s, not found at the configured location: %s',group.name, this.locationName)
					this.locationMatch=false
				}
				})
				return this.locationMatch
			}).forEach((accessConfig)=>{
				accessConfig.chargers.forEach(async(charger)=>{
					//loop each charger
					let chargerData=await this.wallboxapi.getChargerData(this.token, charger).catch(err=>{this.log.error('Failed to get charger data for build. \n%s', err)})
					let uuid=UUIDGen.generate(chargerData.uid)
					let chargerConfig=await this.wallboxapi.getChargerConfig(this.token, charger).catch(err=>{this.log.error('Failed to get charger configs for build. \n%s', err)})
					if(this.accessories[uuid]){
						this.api.unregisterPlatformAccessories(PluginName, PlatformName, [this.accessories[uuid]])
						delete this.accessories[uuid]
					}
					this.log.debug('Registering platform accessory')

					let lockAccessory=this.lockMechanism.createLockAccessory(chargerData,chargerConfig,uuid)
					let lockService=this.lockMechanism.createLockService(chargerData)
					this.lockMechanism.configureLockService(chargerData, lockService)
					lockAccessory.addService(lockService)

					if(this.showSensor){
						let sensorService=this.sensor.createSensorService(chargerData,'SOC')
						this.sensor.configureSensorService(chargerData,sensorService)
						lockAccessory.getService(Service.LockMechanism).addLinkedService(sensorService)
						lockAccessory.addService(sensorService)
					}
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
						let controlService=this.control.createControlService(chargerData,'Charging Amps')
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
			setTimeout(()=>{this.log.info('Wallbox platform finished loading')}, 1500)
		}catch(err){
			if(this.retryAttempt<this.retryMax){
				this.retryAttempt++
				this.log.error('Failed to get devices. Retry attempt %s of %s in %s seconds...',this.retryAttempt, this.retryMax, this.retryWait)
				setTimeout(async()=>{
					this.getDevices()
				},this.retryWait*1000)
			}
			else{
				this.log.error('Failed to get devices...\n%s', err)
			}
		}
	}

	setTokenRefresh(ttl){ // no longer called
			ttl=Math.round((ttl-Date.now())/1000)
			setTimeout(async()=>{
			this.getNewToken()
		},ttl*1000*.9) //will refresh with  ~2.4 hours before a 24 hour clock expires
	}

	async getNewToken(){
		try{
			let refresh=await this.wallboxapi.refresh(this.refreshToken).catch(err=>{this.log.error('Failed to refresh token. \n%s', err)})
			if(refresh.status==401){
				let signin=await this.wallboxapi.signin(this.email, this.password).catch(err=>{this.log.error('Failed to get signin for build. \n%s', err)})
				if(this.showUserMessages){
					this.log.info('New token %s********************%s', signin.data.attributes.token.substring(0,35),signin.data.attributes.token.substring((signin.data.attributes.token).length-35))
				}
				else{
					this.log.debug('New token  %s********************%s', signin.data.attributes.token.substring(0,35),signin.data.attributes.token.substring((signin.data.attributes.token).length-35))
				}
				this.id=signin.data.attributes.user_id
				this.token=signin.data.attributes.token
				this.refreshToken=signin.data.attributes.refresh_token
				return 'Retrieved new token'
			}
			if(refresh.status==200){
				if(this.showUserMessages){
					this.log.info('Refreshed token  %s********************%s', refresh.data.data.attributes.token.substring(0,35),refresh.data.data.attributes.token.substring((refresh.data.data.attributes.token).length-35))
				}
				else{
					this.log.debug('Refreshed token  %s********************%s', refresh.data.data.attributes.token.substring(0,35),refresh.data.data.attributes.token.substring((refresh.data.data.attributes.token).length-35))
				}
				this.id=refresh.data.data.attributes.user_id
				this.token=refresh.data.data.attributes.token
				this.refreshToken=refresh.data.data.attributes.refresh_token
				//this.setTokenRefresh(refresh.data.attributes.ttl) //disabled
				return 'Refreshed exsisting token'
			}
			return 'Failed to update token'
		}catch(err){this.log.error('Failed to refresh token', err)}
	}

	setChargerRefresh(device){
		// Refresh charger status
			setInterval(async()=>{
				await this.getNewToken()
				this.log('API calls for this polling period %s', this.apiCount)
				this.apiCount=0
				this.getStatus(device.id)
				try{
					let checkUpdate=await this.wallboxapi.getChargerConfig(this.token, device.id).catch(err=>{this.log.error('Failed to refresh charger configs. \n%s', err)})
					if(checkUpdate.software.updateAvailable){
						this.log.warn('%s software update %s is available',checkUpdate.name, checkUpdate.software.latestVersion)
					}
				}catch(err){this.log.error('Error checking for update. \n%s', err)}
			}, this.refreshRate*60*60*1000)
		}

	async startLiveUpdate(device){
		clearInterval(this.lastInterval)
		//get new token
		let x=await this.getNewToken()
		if(this,this.showUserMessages){
			this.log.info('Starting live update')
			this.log.info(x)
		}else{
			this.log.debug('Starting live update')
			this.log.debug(x)
		}
		let startTime = new Date().getTime() //live refresh
		if(!this.liveUpdate){this.log.debug('Live update started')}
		this.liveUpdate=true
			let interval = setInterval(async()=>{
				if(new Date().getTime() - startTime > this.liveTimeout*60*1000){
					clearInterval(interval)
					this.liveUpdate=false
					if(this,this.showUserMessages){
						this.log.info('Live update stopped')
					}
					else{
						this.log.debug('Live update stopped')
					}
					return
				}
				this.getStatus(device.id)
				this.log.debug('API call count %s', this.apiCount)
			}, this.liveRefresh*1000)
		this.lastInterval=interval
	}

	calcBattery(batteryService,energyAdded,chargingTime){
    let wallboxChargerName=batteryService.getCharacteristic(Characteristic.Name).value
		try{
			if(this.cars){
				let car=this.cars.filter(charger=>(charger.chargerName==wallboxChargerName))
				if(car[0]){
					this.batterySize=car[0].kwH
				}else {
					this.log.warn('Unable to find charger named "%s" as configured in the plugin settings for car "%s" with charger "%s". Please check your plugin settings.', wallboxChargerName, this.cars[0].carName, this.cars[0].chargerName)
				}
			}
		}catch(err) {this.log.error('Error with config. \n%s', JSON.stringify(this.cars,null,2))}

		if(!this.batterySize){this.batterySize=80}
		let hours = Math.floor(chargingTime / 60 / 60)
		let minutes = Math.floor(chargingTime / 60) - (hours * 60)
		let seconds = chargingTime % 60
		let percentAdded=Math.round(energyAdded/this.batterySize*100)
		this.log.debug('Charging time %s hours %s minutes, charge added %s kWh, %s%',hours,minutes,energyAdded,percentAdded)
		return percentAdded
	}

	async	getStatus(id){
	let statusResponse=await this.wallboxapi.getChargerStatus(this.token, id).catch(err=>{this.log.error('Failed to update charger status. \n%s', err)})
		try{
		this.log.debug('response status %s',statusResponse.status)
			if(statusResponse.status==200){
				this.updateStatus(statusResponse.data)
			}
		}catch(err) {this.log.error('Error updating status. \n%s', err)}
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
			let uuid=UUIDGen.generate(chargerUID)
			let lockAccessory=this.accessories[uuid]
			let controlService
			let switchService
			let outletService
			let lockService
			let batteryService
			let sensorService
			let statusInfo
			let batteryPercent
			this.log.debug('Updating charger ID %s',chargerID)
			lockService=lockAccessory.getServiceById(Service.LockMechanism, chargerID)
			if(this.showBattery){
				batteryService=lockAccessory.getServiceById(Service.Battery, chargerID)
				batteryPercent=this.calcBattery(batteryService,added_kWh,chargingTime)
				if(this.showSensor){sensorService=lockAccessory.getServiceById(Service.HumiditySensor, chargerID)}
			}
			if(this.showControls==1 || this.showControls==4){switchService=lockAccessory.getServiceById(Service.Switch, chargerID)}
			if(this.showControls==5 || this.showControls==4){outletService=lockAccessory.getServiceById(Service.Outlet, chargerID)}
			if(this.showControls==3 || this.showControls==4){controlService=lockAccessory.getServiceById(Service.Thermostat, chargerID)}
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
					if(this.showControls==1 || this.showControls==4){switchService.getCharacteristic(Characteristic.On).updateValue(false)}
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
					if(this.showBattery){
						batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING)
						batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(this.calcBattery(batteryService,added_kWh,chargingTime))
						if(this.showSensor){sensorService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(batteryPercent)}
					}
					break
				case 'chargingMode':
					lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
					lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(true)
					lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(locked)
					lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(locked)
					if(this.showControls==1 || this.showControls==4){switchService.getCharacteristic(Characteristic.On).updateValue(true)}
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
					if(this.showBattery){
						batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.CHARGING)
						batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(this.calcBattery(batteryService,added_kWh,chargingTime))
						if(this.showSensor){sensorService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(batteryPercent)}
					}
					break
				case 'standbyMode':
					lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
					lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(true)
					lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(locked)
					lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(locked)
					if(this.showControls==1 || this.showControls==4){switchService.getCharacteristic(Characteristic.On).updateValue(false)}
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
					if(this.showBattery){
						batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING)
						batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(this.calcBattery(batteryService,added_kWh,chargingTime))
						if(this.showSensor){sensorService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(batteryPercent)}
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
					this.log.warn('Unknown device status received: %s: %s', statusID)
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
