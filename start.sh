pkill -f 'backend/src/forge.ts' 2>/dev/null
sleep 2
cd /home/gaetan/starfleet
export FORGE_DB_PATH=starfleet-demo.db FORGE_WORKTREE_ROOT=/tmp/forge-worktrees FORGE_SHOT_DIR=/tmp/forge-shots
setsid node --import tsx backend/src/forge.ts > /tmp/forge.log 2>&1 < /dev/null &
sleep 9
tail -2 /tmp/forge.log
