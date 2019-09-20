#!/bin/bash          

if [ "$RUN_STARTUP_SCRIPTS" = "true" ] ; then
    echo "Running scripts"
    for filename in /startup-scripts/*.cypher; do
        echo "Attempting to run cypher: $filename" 
        until cypher-shell --non-interactive -u $NEO4J_USER -p $NEO4J_PASSWORD \
            -a $NEO4J_HOST "$(cat $filename)"
        do
            echo "Failed to run $filename, sleeping 10 seconds"
            sleep 10
        done
    done
else
    echo "Skipping scripts because RUN_STARTUP_SCRIPTS was not set to true."
fi

echo "Starting the node WebAPI"
npm start
