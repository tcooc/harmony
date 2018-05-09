#!/bin/bash

forever stop main.js
forever stop bot.js
forever start --uid=harmony --append --minUptime=10000 --spinSleepTime=5000 --killSignal=SIGTERM main.js
forever start --uid=harmony2 --append --minUptime=10000 --spinSleepTime=5000 --killSignal=SIGTERM bot.js
