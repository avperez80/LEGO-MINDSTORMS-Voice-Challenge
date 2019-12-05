# The talking mobile hammer
# By Vanesa Perez

# This is the code for the Lego Brick in the LEGO MINDSTORMS Voice Challenge 

# User can ask "the talking mobile hammer" to move forward, backwards, left or right. 
# There is no direction default value and the user will need to provide it if that is not provided 
# The number of steps to make can be indicated (1 step is one rotation of the motor). Default will be 1 step
# Speed can be set to "fast, medium or slow". Default will be medium (50%)

# The robot can be set to "smash mode". 
# When in this mode the robot moves looking for something to smash and smash it when the user confirms it

# 


import time
import logging
import json
import random
import threading
from enum import Enum

from agt import AlexaGadget

from ev3dev2.led import Leds
from ev3dev2.sound import Sound
from ev3dev2.motor import OUTPUT_A, OUTPUT_B, OUTPUT_C, MoveTank, SpeedPercent, MediumMotor
from ev3dev2.sensor.lego import InfraredSensor

# Set the logging level to INFO to see messages from AlexaGadget
logging.basicConfig(level=logging.INFO)


class Direction(Enum):
    """
    The list of directional commands and their variations.
    These variations correspond to the skill slot values.
    """
    FORWARD = ['forward', 'forwards', 'go forward']
    BACKWARD = ['backward', 'back', 'backwards', 'go backward']
    LEFT = ['left', 'go left']
    RIGHT = ['right', 'go right']
    STOP = ['stop', 'brake', 'halt']
    PAUSE = ['pause']

class DirectionPatrol(Enum):
    """
    The list of directional commands and their variations.
    These variations correspond to the skill slot values.
    """
    FORWARD = ['forward']
    #BACKWARD = ['backward']
    LEFT = ['left']
    RIGHT = ['right']

class EventName(Enum):
    """
    The list of custom event name sent from this gadget
    """
    PROXIMITY = "Proximity"
    SMASH =  "Smash"


class MindstormsGadget(AlexaGadget):
    """
    A Mindstorms gadget that can perform bi-directional interaction with an Alexa skill.
    """

    def __init__(self):
        """
        Performs Alexa Gadget initialization routines and ev3dev resource allocation.
        """
        super().__init__()

        # Robot state
        self.patrol_mode = False
        self.enemy_not_detected =  True
        print("+++++ self.patrol_mode = {} y self.enemy_not_detected = {}".format(self.patrol_mode, self.enemy_not_detected))
        self.positionX = 0
        self.positionY = 0
        self.direction = ['forward', 'right', 'backward', 'left']
        self.offset = [0, 1, 0, -1]
        self.index = 0
        self.pointing = self.direction[self.index]


        # Connect two large motors on output ports B and C
        self.drive = MoveTank(OUTPUT_B, OUTPUT_C)
        self.weapon = MediumMotor(OUTPUT_A)
        self.sound = Sound()
        self.leds = Leds()
        self.ir = InfraredSensor()

        # Start threads
        threading.Thread(target=self._patrol_thread, daemon=True).start()
        threading.Thread(target=self._proximity_thread, daemon=True).start()

    def on_connected(self, device_addr):
        """
        Gadget connected to the paired Echo device.
        :param device_addr: the address of the device we connected to
        """
        self.leds.set_color("LEFT", "GREEN")
        self.leds.set_color("RIGHT", "GREEN")
        print("{} connected to Echo device".format(self.friendly_name))

    def on_disconnected(self, device_addr):
        """
        Gadget disconnected from the paired Echo device.
        :param device_addr: the address of the device we disconnected from
        """
        self.leds.set_color("LEFT", "BLACK")
        self.leds.set_color("RIGHT", "BLACK")
        print("{} disconnected from Echo device".format(self.friendly_name))

    def on_custom_mindstorms_gadget_control(self, directive):
        """
        Handles the Custom.Mindstorms.Gadget control directive.
        :param directive: the custom directive with the matching namespace and name
        """
        try:
            payload = json.loads(directive.payload.decode("utf-8"))
            print("Control payload: {}".format(payload))
            control_type = payload["type"]

            if control_type == "moveSteps":
                # Expected params: [direction, steps, speed]
                self.enemy_not_detected = True
                self._moveSteps(payload["direction"], int(payload["steps"]), int(payload["speed"]))

            if control_type == "patrol":
                self.patrol_mode = True
                self.enemy_not_detected = True
            
            if control_type == "smash":
                print("SMASHING")
            
                self.weapon.on_for_degrees(SpeedPercent(100), 300)
                self.weapon.on_for_degrees(SpeedPercent(-50), 300)
                time.sleep(5)
                self._send_event(EventName.SMASH, {'Smashed': 1})
                #self.smash_mode = False
                print("1 smashed")
                self.enemy_not_detected =  True
                print("+++++ self.patrol_mode = {} y self.enemy_not_detected = {}".format(self.patrol_mode, self.enemy_not_detected))
                self.leds.set_color("LEFT", "GREEN", 1)
                self.leds.set_color("RIGHT", "GREEN", 1)
                

        except KeyError:
            print("Missing expected parameters: {}".format(directive))

    def _moveSteps(self, direction, steps: int, speed: int, is_blocking=False):
        """
        Handles move commands from the directive.
        Right and left movement can under or over turn depending on the surface type.
        :param direction: the move direction
        :param steps: the duration in steps that translate into number of rotations
        :param speed: the speed percentage as an integer
        :param is_blocking: if set, motor run until duration expired before accepting another command
        """
        print("Move command: ({}, {}, {}, {})".format(direction, speed, steps, is_blocking))
        if direction in Direction.FORWARD.value:
            self.drive.on_for_rotations(SpeedPercent(speed), SpeedPercent(speed), steps, block=is_blocking)

        if direction in Direction.BACKWARD.value:
            self.drive.on_for_rotations(SpeedPercent(-speed), SpeedPercent(-speed), steps, block=is_blocking)

        if direction in Direction.LEFT.value:
            self._turn(direction, speed)
            self.drive.on_for_rotations(SpeedPercent(speed), SpeedPercent(speed), steps, block=is_blocking)
            offset = -1
            self.index = self.new_index(self.index, offset)
            self.pointing = self.direction[self.index]

        if direction in Direction.RIGHT.value:
            self._turn(direction, speed)
            self.drive.on_for_rotations(SpeedPercent(speed), SpeedPercent(speed), steps, block=is_blocking)
            offset = 1
            self.index = self.new_index(self.index, offset)
            self.pointing = self.direction[self.index]

        if direction in Direction.STOP.value:
            self.drive.off()
            self.patrol_mode = False
            self.enemy_not_detected = False
            print("STOP!! patrol mode = {} y enemy not detected = {}".format(self.patrol_mode, self.enemy_not_detected))

        if direction in Direction.PAUSE.value:
            self.drive.off()
            print("Pause to kill the enemy")

    def _turn(self, direction, speed):
        """
        Turns based on the specified direction and speed.
        Calibrated for hard smooth surface.
        :param direction: the turn direction
        :param speed: the turn speed
        """
        if direction in Direction.LEFT.value:
            self.drive.on_for_degrees(SpeedPercent(speed), SpeedPercent(-speed), 490, block=True)

        if direction in Direction.RIGHT.value:
            self.drive.on_for_degrees(SpeedPercent(-speed), SpeedPercent(speed), 490, block=True)

    def _send_event(self, name: EventName, payload):
        """
        Sends a custom event to trigger a sentry action.
        :param name: the name of the custom event
        :param payload: the sentry JSON payload
        """
        self.send_custom_event('Custom.Mindstorms.Gadget', name.value, payload)

    def _proximity_thread(self):
        """
        Monitors the distance between the robot and an obstacle when sentry mode is activated.
        If the minimum distance is breached, send a custom event to trigger action on
        the Alexa skill.
        """
        count = 0
        while True:
            print("---------------- Analizo si debo detectar enemigos - PROXIMITY")
            print("----- DEBO?? ::::> self.enemy_not_detected = {}".format(self.enemy_not_detected))
            while self.enemy_not_detected:
                distance = self.ir.proximity
                #print("Proximity: {}".format(distance))
                count = count + 1 if distance < 30 else 0
                if count > 2:
                    
                    print("Proximity breached. Sending event to skill")
                    self.leds.set_color("LEFT", "RED", 1)
                    self.leds.set_color("RIGHT", "RED", 1)
                    self.enemy_not_detected =  False
                    print("+++++ self.patrol_mode = {} y self.enemy_not_detected = {}".format(self.patrol_mode, self.enemy_not_detected))
                    self._moveSteps('pause', 0, 0)
                    count = 0
                    self._send_event(EventName.PROXIMITY, {'distance': distance})
                    time.sleep(5)
                time.sleep(0.2)

            time.sleep(1)

    def _patrol_thread(self):
        """
        Performs random movement when patrol mode is activated.
        It will be moving with steps from 1 to 3, within a square of 6 steps size, 
        and it can move from 25% or 75% speed
        """
        while True:
            print("---------------- Analizo si debo hacer patruya - PATROL")
            print("----- DEBO?? ::::> self.patrol_mode = {}".format(self.patrol_mode))

            while self.patrol_mode:
                print("---------------- Analizo si debo detectar enemigos - PROXIMITY")
                print("----- DEBO?? ::::> self.enemy_not_detected = {}".format(self.enemy_not_detected))
                while self.enemy_not_detected:
                    print("Patrol mode activated randomly picks a path")
                    direction = random.choice(list(DirectionPatrol))
                    steps = random.randint(2, 3)
                    speed = random.randint(2, 3) * 20

                    notInZone = self.calculate_in_zone(direction.value[0], steps)    
                    while notInZone:
                        direction = random.choice(list(DirectionPatrol))
                        steps = random.randint(2, 3)
                        speed = random.randint(2, 3) * 20    
                        notInZone = self.calculate_in_zone(direction.value[0], steps)    

                    # direction: all except stop and backwards, duration: 2-3steps, speed: 40, 60
                    self._moveSteps(direction.value[0], steps, speed)
                    time.sleep(2+(steps*(100-speed)/75))
            print("###Enemigo detectado, no entro en patruya hasta que self.enemy_not_detected = {}".format(self.enemy_not_detected))
            time.sleep(1)
        print("###Salgo de la patruya, no entro en patruya hasta que self.patrol_mode = {}".format(self.patrol_mode))


    def new_index(self, index, offset):
        index = index + offset
        if (index < 0):
            index = 3
        if (index > 3):
            index = 0
        return index

    def calculate_in_zone(self, direction, steps):
        '''
        There is a square of 6x6 steps and the robot cannot go away the boundaries
        So this will let the robot know if the next move action will lead him to go out of the square
        positionX and positionY can be between -3 and +3 value, starting always in 0,0
        '''
        realDirectionIndex = self.new_index(self.index,self.offset[self.direction.index(direction)])
        
        realDirection = self.direction[realDirectionIndex]
        if (realDirection == 'forward'):
            targetX = self.positionX
            targetY = self.positionY + steps
        elif (realDirection == 'backward'):
            targetX = self.positionX
            targetY = self.positionY - steps
        elif (realDirection == 'left'):
            targetX = self.positionX - steps
            targetY = self.positionY     
        elif (realDirection == 'right'):
            targetX = self.positionX + steps
            targetY = self.positionY   
        

        if ((abs(targetX)>3) or (abs(targetY)>3)):
            return True
        else:
            self.positionX = targetX
            self.positionY = targetY
            print("Target position Move command: ({}, {})".format(targetX, targetY))
            print("Direction: {}".format(direction))
            print("Pointing: {}".format(self.pointing))
            print("realDirection: {}".format(realDirection))

            return False

if __name__ == '__main__':
    # Startup sequence
    gadget = MindstormsGadget()
    gadget.sound.play_song((('C4', 'e'), ('D4', 'e'), ('E5', 'q')))
    gadget.leds.set_color("LEFT", "GREEN")
    gadget.leds.set_color("RIGHT", "GREEN")

    # Gadget main entry point
    gadget.main()

    # Shutdown sequence
    gadget.sound.play_song((('E5', 'e'), ('C4', 'e')))
    gadget.leds.set_color("LEFT", "BLACK")
    gadget.leds.set_color("RIGHT", "BLACK")
