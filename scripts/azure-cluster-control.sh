#!/bin/bash

# Azure AKS Cluster Control Script
# Usage: ./azure-cluster-control.sh [start|stop|status]

# Quick Reference Commands:
# cd /Users/macbook/Documents/SpringBoot\ Anuj/Microservices/scripts
# ./azure-cluster-control.sh stop
# ./azure-cluster-control.sh start
# ./azure-cluster-control.sh status
# ./azure-cluster-control.sh ready

CLUSTER_NAME="codexa-aks"
RESOURCE_GROUP="codexa-rg"

case "$1" in
  start)
    echo "Starting AKS cluster: $CLUSTER_NAME..."
    az aks start --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP
    echo "AKS cluster started successfully!"
    ;;
  stop)
    echo "Stopping AKS cluster: $CLUSTER_NAME..."
    az aks stop --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP
    echo "AKS cluster stopped successfully!"
    ;;
  status)
    echo "Checking AKS cluster status: $CLUSTER_NAME..."
    az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP --query powerState -o tsv
    ;;
  ready)
    echo "Checking if AKS cluster is ready: $CLUSTER_NAME..."
    az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP --query '{powerState: powerState, provisioningState: provisioningState}' -o tsv
    echo ""
    echo "If cluster is Running, wait 5-10 minutes for all services to start"
    ;;
  *)
    echo "Usage: $0 {start|stop|status|ready}"
    echo ""
    echo "Commands:"
    echo "  start  - Start the AKS cluster"
    echo "  stop   - Stop the AKS cluster"
    echo "  status - Check cluster status"
    echo "  ready  - Check if cluster is ready for use"
    exit 1
    ;;
esac
