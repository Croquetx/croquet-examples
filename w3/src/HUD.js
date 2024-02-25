import { QUIToggle, QUIToggleSet, QUIButton, QView } from "@croquet/q";

export class HUD extends QView {
    constructor() {
        super();
        const root = this.getNamedView("QUI").root;

        const button1 = new QUIToggle(root);
        button1.setPosition([0, 20]);
        button1.setSize([80, 30]);
        button1.text.setText("Dig");
        button1.onToggleOn = function () {button1.publish("ui", "digMode");};

        const button2 = new QUIToggle(root);
        button2.setPosition([0, 60]);
        button2.setSize([80, 30]);
        button2.text.setText("Fill");
        button2.onToggleOn = function () { button2.publish("ui", "fillMode");};

        const button3 = new QUIToggle(root);
        button3.setPosition([0, 100]);
        button3.setSize([80, 30]);
        button3.text.setText("Spawn");
        button3.onToggleOn = function () { button3.publish("ui", "spawnMode");};

        const button4 = new QUIToggle(root);
        button4.setPosition([0, 140]);
        button4.setSize([80, 30]);
        button4.text.setText("Road");
        button4.onToggleOn = function () { button4.publish("ui", "roadMode");};

        const button5 = new QUIToggle(root);
        button5.setPosition([0, 180]);
        button5.setSize([80, 30]);
        button5.text.setText("View");
        button5.onToggleOn = function () { button5.publish("ui", "pawnCamera");};
        button5.onToggleOff = function () { button5.publish("ui", "normalCamera");};

        const button6 = new QUIButton(root);
        button6.setPosition([0, 250]);
        button6.setSize([80, 30]);
        button6.text.setText("New");
        button6.onButtonPress = function () { button6.publish("ui", "newLevel");};

        const toggleSet = new QUIToggleSet();
        toggleSet.addToggle(button1);
        toggleSet.addToggle(button2);
        toggleSet.addToggle(button3);
        toggleSet.addToggle(button4);
        button1.setState(true);

        const zoomIn = new QUIButton(root);
        zoomIn.anchor = [1,1];
        zoomIn.setPosition([-120,-120]);
        zoomIn.setSize([50,50]);
        zoomIn.text.setText("+");
        zoomIn.text.setPoint(20);
        zoomIn.onButtonPress = function () { zoomIn.publish("ui", "zoomIn");};

        const zoomOut = new QUIButton(root);
        zoomOut.anchor = [1,1];
        zoomOut.setPosition([-60, -120]);
        zoomOut.setSize([50,50]);
        zoomOut.text.setText("-");
        zoomOut.text.setPoint(20);
        zoomOut.onButtonPress = function () { zoomOut.publish("ui", "zoomOut");};

        const spinLeft = new QUIButton(root);
        spinLeft.anchor = [1,1];
        spinLeft.setPosition([-120, -60]);
        spinLeft.setSize([50,50]);
        spinLeft.text.setText("<");
        spinLeft.text.setPoint(20);
        spinLeft.onButtonPress = function () { spinLeft.publish("ui", "spinLeft");};

        const spinRight = new QUIButton(root);
        spinRight.anchor = [1,1];
        spinRight.setPosition([-60, -60]);
        spinRight.setSize([50,50]);
        spinRight.text.setText(">");
        spinRight.text.setPoint(20);
        spinRight.onButtonPress = function () { spinRight.publish("ui", "spinRight");};
    }
}
