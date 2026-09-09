sleep 7
cd ~/starfleet
T=$(cat .forge-token)
H="-H x-forge-token:$T -H content-type:application/json"

body() {
  echo "{\"url\":\"$1\",\"pace\":\"live\",\"script\":[{\"kind\":\"goto\",\"target\":\"$1\"},{\"kind\":\"expectText\",\"target\":\"#app\",\"value\":\"FORGE\"}]}"
}

echo "-- start 1"
curl -s $H -X POST -d "$(body http://127.0.0.1:8830/login)" http://127.0.0.1:8830/api/stories/1/pilot \
  | node -e "let r='';process.stdin.on('data',c=>r+=c).on('end',()=>{const a=JSON.parse(r);console.log(a.state ?? a)})"
echo "-- start 3"
curl -s $H -X POST -d "$(body http://127.0.0.1:8830/story)" http://127.0.0.1:8830/api/stories/3/pilot \
  | node -e "let r='';process.stdin.on('data',c=>r+=c).on('end',()=>{const a=JSON.parse(r);console.log(a.state ?? a)})"

echo "-- avance 1 puis 3, chacun doit voir SA page"
for s in 1 3 1 3; do
  curl -s $H -X POST "http://127.0.0.1:8830/api/stories/$s/pilot/advance" \
    | node -e "let r='';process.stdin.on('data',c=>r+=c).on('end',()=>{const a=JSON.parse(r);
      console.log('story', a.storyReference ?? '?', a.state ?? a.error, JSON.stringify((a.acts??[]).map(x=>x.detail)))})"
done
