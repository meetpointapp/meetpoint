cd "$(dirname "$0")"
for pass in 1 2; do
while IFS='|' read -r n t; do f=real/$n.jpg; [ -s $f ] && continue; python3 ../scripts/commons_get.py get "$t" $f 1280 2>&1 | tail -1 | cut -c1-100; [ -s $f ] || python3 ../scripts/commons_get.py get "$t" $f 900 2>&1 | tail -1 | cut -c1-100; sleep 15; done < list3.txt
done
echo ALL3DONE
