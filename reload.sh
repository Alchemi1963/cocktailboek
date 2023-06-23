#!/bin/bash
systemctl stop cocktailboek.service
git pull
systemctl start cocktailboek.service
