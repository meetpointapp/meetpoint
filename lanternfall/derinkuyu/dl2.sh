cd "$(dirname "$0")"
until grep -q ALLDONE dl.log; do sleep 20; done
while IFS='|' read -r n t; do f=real/$n.jpg; [ -s $f ] || python3 ../scripts/commons_get.py get "$t" $f 1280; sleep 10; done < list2.txt
echo ALL2DONE
