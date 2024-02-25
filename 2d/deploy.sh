#!/bin/bash
cd `dirname "$0"`

TARGET=../../servers/croquet-io-dev
CROQUET=../libraries/packages/croquet

# check out a clean @croquet/croquet package
(cd $CROQUET ; npm run clean)

# build 2d.html avatars.html and many.html into separate directories
for APP in 2d avatars many ; do
    npx parcel build src/$APP.html --dist-dir $TARGET/$APP/ --public-url . || exit
    mv $TARGET/$APP/$APP.html $TARGET/$APP/index.html
done

# strip source map comment to avoid warnings
# (source map is still loadable in chrome dev tools)
perl -pi -e 's,^//# sourceMappingURL.*,,' $TARGET/{2d,avatars}/*.js
# perl instead of sed so in-place edit works on both mac and linux

git add -A $TARGET/{2d,avatars,many}
git commit -m "[2d] deploy to croquet.io/dev" $TARGET/{2d,avatars,many} || exit
git --no-pager show --stat

echo
echo "You still need to"
echo "    git push"
echo "to deploy to https://croquet.io/dev/"
