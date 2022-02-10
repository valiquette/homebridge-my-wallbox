'use strict'
let wallboxAPI=require('./wallboxapi')
let lockMechanism=require('./devices/lock')

class wallboxPlatform {

  constructor(log, config, api){
    this.wallboxapi=new wallboxAPI(this,log)
		this.lockMechanism=new lockMechanism(this,log)

    this.log=log
    this.config=config
    this.email=config.email
    this.password=config.password
    this.token
		this.rate=config.rate
		//this.ttl
		this.id
    this.userId
		this.accessories=[]
    if(!config.email || !config.password){
      this.log.error('Valid email and password are required in order to communicate with the b-hyve, please check the plugin config')
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
				this.wallboxapi.getId(this.token,this.id).then(response=>{
					this.log.debug('Found User ID %s',response.data.data.attributes.value)
					this.userId=response.data.data.attributes.value
					this.wallboxapi.getUser(this.token,this.userId).then(response=>{
						this.log.info('Found account for %s %s', response.data.data.name, response.data.data.surname)
						//loop each charger
						response.data.data.accessConfigs.forEach((accessConfig)=>{
							accessConfig.chargers.forEach((charger)=>{
								this.wallboxapi.getChargerData(this.token,charger).then(response=>{
									let chargerData=response.data.data.chargerData
									let uuid=UUIDGen.generate(chargerData.uid)							
									if(this.accessories[uuid]){
										this.api.unregisterPlatformAccessories(PluginName, PlatformName, [this.accessories[uuid]])
										delete this.accessories[uuid]
									}
									let lockAccessory=this.lockMechanism.createLockAccessory(chargerData,uuid)
									let lockService=lockAccessory.getService(Service.Tunnel)
									lockService=this.lockMechanism.createLockService(chargerData)
									this.lockMechanism.configureLockService(lockService,chargerData.locked)
									this.updateStatus(lockService, chargerData.statusDescription)
									lockAccessory.addService(lockService)
									this.accessories[uuid]=lockAccessory                     
									this.log.info('Adding Lock for %s charger ', chargerData.name)
									this.log.debug('Registering platform accessory')
									this.api.registerPlatformAccessories(PluginName, PlatformName, [lockAccessory])
									this.setChargerRefresh(lockService,chargerData.id)

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

		setChargerRefresh(lockService,id){
			// Refresh charger status
				setInterval(()=>{		
					try{		
						this.wallboxapi.getChargerData(this.token,id).then(response=>{
							this.log.debug('refreshed charger %s',response.data.data.chargerData.id)
							this.log.info('Charger status %S',response.data.data.chargerData.statusDescription)
							this.updateStatus(lockService,response.data.data.chargerData.statusDescription)
						}).catch(err=>{this.log.error('Failed signin to refresh charger', err)})
					}catch(err){this.log.error('Failed to refresh charger', err)}	
				}, this.rate*60*1000)
			}

		updateStatus(lockService,status){
			switch(status){
				case 'Ready':
					lockService.setCharacteristic(Characteristic.StatusFault, Characteristic.StatusFault.NO_FAULT)
					lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.UNSECURED)
					lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.UNSECURED)
					break
				case 'Offline':
				this.log.warn('%s disconnected at %s! This will show as non-responding in Homekit until the connection is restored.',chargerData.name, new Date(chargerData.lastConnection).toLocaleString())
				lockService.setCharacteristic(Characteristic.StatusFault, Characteristic.StatusFault.GENERAL_FAULT)
				break
				case 'Locked':
					lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.SECURED)
					lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.SECURED)
				break
				default:
					this.log.warn('Unknown device message received: %s',status)
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