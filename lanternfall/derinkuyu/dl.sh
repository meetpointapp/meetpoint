cd "$(dirname "$0")"
i=0
while read -r t; do i=$((i+1)); f=real/p$(printf %02d $i).jpg; [ -s $f ] || python3 ../scripts/commons_get.py get "$t" $f 1920; sleep 9; done < list.txt
echo ALLDONE
