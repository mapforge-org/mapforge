#!/bin/bash

for file in *.png; do

    # noto icon name eg: emoji_u1f34b_200d_1f7e9.png
    # openmoji icon names eg: 0034-FE0F-20E3.png

    filename_without_prefix="${file#emoji_u}"
    filename_without_extension="${filename_without_prefix%.*}"
    
    # change depending on emoji filenames
    IFS='_' read -ra parts <<< "$filename_without_extension"
    
    new_filename=""
    for part in "${parts[@]}"; do
        # echo "Working on $part"
        char=$(printf "\\U$part")
        new_filename+="$char"
    done
    
    echo "$new_filename"
    new_filename+=".png"
    
    cp "$file" "$new_filename"
done

