import json, math, shutil
from PIL import Image
import os
os.chdir(r"C:/Users/USER/Downloads/skp_client/site")
os.makedirs("lobby-premium/panos", exist_ok=True)
shutil.copy2(r"C:/Users/USER/Downloads/skp_client/mbath_out/lobby_pano.jpg", "lobby-premium/panos/lobby.jpg")
shutil.copy2(r"C:/Users/USER/Downloads/skp_client/mbath_out/lobby_depth.png", "lobby-premium/panos/depth_rgbd.png")
Image.open("lobby-premium/panos/lobby.jpg").resize((512,256), Image.LANCZOS).save("tour-nav/thumbs/lobby.jpg", quality=88)

m = json.load(open('tour-nav/manifest.json'))
rc = json.load(open('tour-nav/room_cams.json'))

# lobby marker yaws from world bearings (viewer yaw = rotz - bearing):
# family lounge cam bearing from lobby cam:
dx = rc['living_room']['cam'][0]-5.8; dy = rc['living_room']['cam'][1]-7.6
b_fl = math.degrees(math.atan2(dx,dy))
# downstairs via stairs: stair void bearing ~120 world
b_st = 120.0
lobby = {
  "id": "lobby",
  "name": "Lobby & Stairs",
  "pano": "../lobby-premium/panos/lobby.jpg",
  "thumb": "thumbs/lobby.jpg",
  "depth": "../lobby-premium/panos/depth_rgbd.png",
  "plan_xy": [5.8, 7.6],
  "walk_clamp": 1.4,
  "hotspots": [
    {"to":"living_room","yaw":round(math.radians(120.0-b_fl),4),"pitch":-0.3,"icon":"\ud83d\udeaa","label":"To Family Lounge","floor_dist":2.5},
    {"to":"terrace_living","yaw":round(math.radians(120.0-b_st),4),"pitch":-0.3,"icon":"\ud83d\udeaa","label":"Downstairs to Main Living","floor_dist":2.8},
  ]
}
if not any(r['id']=='lobby' for r in m['rooms']):
    m['rooms'].append(lobby)

# family lounge: relink to lobby
for r in m['rooms']:
    if r['id']=='living_room':
        for h in r['hotspots']:
            if h.get('to')=='terrace_living':
                h['to']='lobby'; h['label']='To Lobby & Stairs'

rc['lobby'] = {"cam":[5.8,7.6,5.75], "rotz":120.0, "floor":4.2}

s = json.dumps(m, indent=1); json.loads(s)
open('tour-nav/manifest.json','w',encoding='utf-8').write(s)
json.dump(rc, open('tour-nav/room_cams.json','w'), indent=1)
print("lobby room added:", len(m['rooms']), "rooms total")
print("family lounge hotspots:", [(h.get('label'),h.get('to')) for h in [r for r in m['rooms'] if r['id']=='living_room'][0]['hotspots']])
