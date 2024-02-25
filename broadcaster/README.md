**internal manual**
last modified on 2021-09-15, or Sep 15th, 2021

This app is created to do eye-to-eye conversation demo. It works best for up to 3 people, and it is intended to run in Greenlight.

If you open JavaScript console, and execute a line

    window.backdropURL = "https://croquet.io/broadcaster?q=abcdefg" #pick a name that is unique"

Greenlight's bottom right presentation menu gets one more item. If you choose "Set desktop background" from the presentatino menu, the app goes background.  If you click on the pause/play button at the bottom, your video starts.

You clear the backdropURL variable:

    window.backdropURL = ""

and then choose the menu item again to clear the background.

