'use strict'
let wallboxAPI=require('./wallboxapi')
let lockMechanism=require('./devices/lock')
let battery=require('./devices/battery')

class wallboxPlatform {

  constructor(log, config, api){
    this.wallboxapi=new wallboxAPI(this ,log)
		this.lockMechanism=new lockMechanism(this, log)
		this.battery=new battery(this, log)

    this.log=log
    this.config=config
    this.email=config.email
    this.password=config.password
    this.token
		this.rate=config.rate
		this.id
    this.userId
		this.accessories=[]
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
			
			this.wallboxapi.signin(this.email,this.password).then(response=>{
				this.log.debug('Found User ID %s',response.data.data.attributes.user_id)
				this.log.debug('Found Token %s',response.data.data.attributes.token)
				this.id=response.data.data.attributes.user_id 
				this.token=response.data.data.attributes.token 
				this.setTokenRefresh(response.data.data.attributes.ttl)
				//get token
				this.wallboxapi.getId(this.token,this.id).then(response=>{
					this.log.debug('Found User ID %s',response.data.data.attributes.value)
					this.userId=response.data.data.attributes.value
					//get user id
					this.wallboxapi.getUser(this.token,this.userId).then(response=>{
						this.log.info('Found account for %s %s', response.data.data.name, response.data.data.surname)	
						response.data.data.accessConfigs.forEach((accessConfig)=>{
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
									lockAccessory.addService(batteryService)
									this.accessories[uuid]=lockAccessory                     
									this.api.registerPlatformAccessories(PluginName, PlatformName, [lockAccessory])
									this.setChargerRefresh(lockService, batteryService, chargerData.id)
									this.updateStatus(lockService, batteryService, chargerData)
								}).catch(err=>{this.log.error('Failed to get info for build', err)})
							})
						})
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

		setChargerRefresh(lockService, batteryService, id){
			// Refresh charger status
				setInterval(()=>{		
					try{		
						this.wallboxapi.getChargerData(this.token,id).then(response=>{
							let chargerData=response.data.data.chargerData
							this.log.debug('refreshed charger %s',chargerData.id)
							this.log.info('Charger status %s',chargerData.statusDescription)
							this.updateStatus(lockService, batteryService, chargerData)
						}).catch(err=>{this.log.error('Failed signin to refresh charger', err)})
					}catch(err){this.log.error('Failed to refresh charger', err)}	
				}, this.rate*60*1000)
			}

		updateStatus(lockService, batteryService, chargerData){
			switch(chargerData.statusDescription){
				case 'Ready':
					lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
					lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(false)
					lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(Characteristic.LockCurrentState.UNSECURED)
					lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.UNSECURED)
					batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING)
					break
				case 'Charging':
					lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
					lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(true)
					lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(Characteristic.LockCurrentState.UNSECURED)
					lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.UNSECURED)
					batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(chargerData.stateOfCharge)
					batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.CHARGING)
					break	
				case 'Connected: waiting for car demand':
					lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
					lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(true)
					lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(Characteristic.LockCurrentState.UNSECURED)
					lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.UNSECURED)
					batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING)
					break	
				case 'Offline':
				this.log.warn('%s disconnected at %s! This will show as non-responding in Homekit until the connection is restored.',chargerData.name, new Date(chargerData.lastConnection*1000).toLocaleString())
					lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.GENERAL_FAULT)
					break
				case 'Locked':
					lockService.getCharacteristic(Characteristic.StatusFault).updateValue(Characteristic.StatusFault.NO_FAULT)
					lockService.getCharacteristic(Characteristic.OutletInUse).updateValue(false)
					lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(Characteristic.LockCurrentState.SECURED)
					lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.SECURED)
					batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGING)
					break
				default:
					this.log.warn('Unknown device message received: %s',chargerData.statusDescription)
					break	
			}

		}	
  //**
  //** REQUIRED - Homebridge will call the "configureAccessory" method once for every cached accessory restored
  //**
  configureAccessory(accessory){
    // Added cached devices to the accessories arrary
    this.log.debug('Found cached accessory %s', accessory.displayName);
    this.accessories[accessory.UUID]=accessory;
  }
  
}

module.exports=wallboxPlatform