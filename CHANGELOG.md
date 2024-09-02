# Changes

## 1.1.23
Update
-  Bumped dependencies.
-  Updated header info for API call
-  Renamed Start/pause to Charging

## 1.1.22
Update
-  Bumped dependencies.
-  homebridge 2.0 support

## 1.1.21
Fix
-  Fix bug with pause switch/outlet.
-  Bumped dependencies.

## 1.1.20
Update
-  Minor code cleanup
-  Fix model type characteritic.
-  Added support for cached accessories

## 1.1.19
Update
-  Bumped dependencies.

## 1.1.18
Update
-  Added suppport for node.js v20.
-  Removed support for node.js v14.
-  Bumped dependencies.

## 1.1.17
Update
- Updated Readme
- Code cleanup

## 1.1.16
Fix
- Fixed slow to update warnings.
- Fixed 401 errors from Homebridge UI, HomeKit did not experiance this issue.
Update
- Updated switch and outlet naming.
- Code cleanup.
- Bumped dependencies.

## 1.1.15
Fix
- Fixed slow update response when attempting to pause/resume without an active session.

## 1.1.14
Fix issue #16
- Some token TTLs are very short, 15 minutes vs 24 hours and could result in non recoverable unauthorzed messages.
- Refactored updates to now refresh token prior to a new live update session.
- Removed scheduled token refresh cycle.
- Added logic to automatically sign in again if unauthorized response is recieved.
- Removed 401 error from APi retrying, will automatically obtain new token.
- Added config setting to log user info in normal log.

## 1.1.13
Test
- Exposed information around token timeouts.

## 1.1.12
Update
- Improved error handling.
- Improved error messaging.
- Added retry logic for some API errors.
- Cleaned whitespace.

## 1.1.10
Fix
- Fixed bug with token refresh (issue #16).
Update
- Improved error handling.
- Bumped dependencies.

## 1.1.9
Fix
- Fixed un-caught error.

## 1.1.8
Fix
- Fixed bug with token refresh (issue #16).
Update
- Added option to suppress API responses in debug log.
- Code cleanup.
- Improved error handling.
- Bumped dependencies.

## 1.1.7
Update
- Code cleanup.
- Bumped dependencies.

## 1.1.6
Fix
- Fix error handling during startup when configuration has missing info.
Update
- Improved error handling for lock.
- Updated Axios to address error for unexpected end of file error.
- Bumped dependencies.

## 1.1.5
Update
- Fix Axios error for unexpected end of file error.

## 1.1.4
Update
- Bumped dependencies.

## 1.1.3
Update
- Code cleanup
- Cleanup log messaging.
- Option to add Humidity Sensor for Battery percentage to create HomeKit automations. (HomeKit doesn't allow for automations off of battery percentage)
- Bumped dependencies.

## 1.1.2
Update
- Refactored token refresh logic, ttl is now 24 hours and will refresh when <2% of time is remaining.
- Will now record count all API calls in debug log for reporting period.
-	Added explicit user-agent info to API calls.
-	Bumped dependencies.
- Code cleanup.

## 1.1.1
Update
- Refactored startup code.
- Fixed bug refreshing token after API changed ttl from 15 days to 15 mins
-	Added some retry logic if network is down during a restart
- Code cleanup.

## 1.1.0
Update
- Changed API endpoint for status updates.
-	Refactored code for status updates.
- Added support for additional status messages.
- Refactored code for battery status
-	Added status descriptions to logging after being dropped from API response.
- Bumped dependencies.
-	Code cleanup.
- Updated Readme
- Fixed some typos in logging output.
- Bug fixes for some error handling.

## 1.0.14
Update
- Improved/updated some error messaging
- Fixed bug with Start/Pause control
- Refactored code for better polling behavior
- Added outlet option for Start/Pause function
- Removed option for light control for amperage due to confusing percentage
- Added support for devices using Celsius


## 1.0.13
Update
-	Correct error handling on start and include retry logic.
- Cleaned up some error messaging
-	Bumped dependencies

## 1.0.12

Update
- Added support for new status message.
- Cleaned up some error messaging

## 1.0.11
Test

## 1.0.10
Fix
-	Fix bug preventing successful start with default settings.

## 1.0.9
Update
-	Code cleanup
- Bumped dependencies
- Corrected benign unknown device warning message.

## 1.0.8 -beta
Update
- Code cleanup
- bumped dependencies
- corrected benign unknown device warning message.

## 1.0.7
Update
-	Tied battery service option to having a car defined.

## 1.0.6
Update
- Estimate battery charge added.
- Added support for Start/Stop and Amps
- Added location support
- Code cleanup
- Fix bug with "waiting' message

## 1.0.5
Update
- Improved status updates.
- Improved error logging.
- Removed Null warning condition.

## 1.0.4
Update
- Added additional detail for battery state and cable connected in HomeKit.
- Added verified badge.

## 1.0.3
Update
- Cleanup Code.
- Updated Readme.

## 1.0.2
Fix
- Address bug when status update did not match expected response.

## 1.0.1
Initial
- HomeKit support for Wallbox Charger locking.
