#!/bin/bash

# GA4 tracking code to insert
GA4_CODE='<!-- Google Analytics 4 -->\
<script async src="https://www.googletagmanager.com/gtag/js?id=G-L8XL675H9L"></script>\
<script>\
    window.dataLayer = window.dataLayer || [];\
    function gtag(){dataLayer.push(arguments);}\
    gtag('\''js'\'', new Date());\
    gtag('\''config'\'', '\''G-L8XL675H9L'\'');\
</script>'

# Counter
count=0

# Find all index.html files in dist folder
find /Volumes/Wotg\ Drive\ Mike/GitHub/marga-biz/dist -name "index.html" | while read file; do
    # Check if GA4 is already added
    if ! grep -q "G-L8XL675H9L" "$file"; then
        # Insert GA4 code after <head> tag
        sed -i '' 's|<head>|<head>\
<!-- Google Analytics 4 -->\
<script async src="https://www.googletagmanager.com/gtag/js?id=G-L8XL675H9L"></script>\
<script>\
    window.dataLayer = window.dataLayer || [];\
    function gtag(){dataLayer.push(arguments);}\
    gtag('\''js'\'', new Date());\
    gtag('\''config'\'', '\''G-L8XL675H9L'\'');\
</script>|' "$file"
        ((count++))
        echo "Added GA4 to: $file"
    fi
done

echo "Done! Added GA4 to $count files."
