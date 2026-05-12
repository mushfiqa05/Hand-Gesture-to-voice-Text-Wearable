#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "BluetoothSerial.h"

LiquidCrystal_I2C lcd(0x27, 16, 2);
BluetoothSerial SerialBT;

// Flex Sensor Pins
#define THUMB 34
#define INDEX 35
#define MIDDLE 32
#define RING 33
#define LITTLE 25

int thumbValue;
int indexValue;
int middleValue;
int ringValue;
int littleValue;

String message = "";

void setup() {

  Serial.begin(115200);
  SerialBT.begin("SmartGlove");

  lcd.init();
  lcd.backlight();

  lcd.setCursor(0,0);
  lcd.print("Smart Glove");

  lcd.setCursor(0,1);
  lcd.print("System Ready");

  delay(2000);
  lcd.clear();
}

void loop() {

  thumbValue  = analogRead(THUMB);
  indexValue  = analogRead(INDEX);
  middleValue = analogRead(MIDDLE);
  ringValue   = analogRead(RING);
  littleValue = analogRead(LITTLE);

  Serial.print("Thumb: ");
  Serial.print(thumbValue);
  Serial.print(" Index: ");
  Serial.print(indexValue);
  Serial.print(" Middle: ");
  Serial.print(middleValue);
  Serial.print(" Ring: ");
  Serial.print(ringValue);
  Serial.print(" Little: ");
  Serial.println(littleValue);

  // Gesture 1 -> HELLO
  if(indexValue > 2500 && middleValue > 2500 && ringValue > 2500)
  {
    message = "HELLO";
  }

  // Gesture 2 -> HELP
  else if(thumbValue > 2500 && littleValue > 2500)
  {
    message = "HELP";
  }

  // Gesture 3 -> THANK YOU
  else if(indexValue > 2500 && middleValue < 2000)
  {
    message = "THANK YOU";
  }

  // Gesture 4 -> YES
  else if(thumbValue < 2000 && indexValue < 2000)
  {
    message = "YES";
  }

  // Gesture 5 -> NO
  else if(ringValue > 2500 && littleValue > 2500)
  {
    message = "NO";
  }

  else
  {
    message = "Waiting...";
  }

  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print("Gesture:");

  lcd.setCursor(0,1);
  lcd.print(message);

  SerialBT.println(message);

  delay(1000);
}