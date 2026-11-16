cd "$(dirname "$0")"
while IFS='|' read -r c p pr; do [ -s clips/$c.mp4 ] && continue; SKIP=a timeout 900 python3 ../scripts/wan_i2v.py crop169/$p.jpg clips/$c.mp4 "$pr" 4 2>&1 | tail -3; done < clips.txt
echo CLIPSDONE
