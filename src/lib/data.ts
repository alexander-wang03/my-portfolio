import React from "react";
import { CgWorkAlt } from "react-icons/cg";
import { FaReact } from "react-icons/fa";
import { LuGraduationCap } from "react-icons/lu";
import tarsImg from "@/assets/tars.png";
import boreaslaneImg from "@/assets/boreaslane.png";
import autorontoImg from "@/assets/autoronto.jpg";
import synthboardImg from "@/assets/synthboard.jpeg";
import packagebotImg from "@/assets/packagebot.jpg";
import { FaPython, FaAws, FaGitAlt, FaLinux, FaRobot, FaGithub} from "react-icons/fa";
import { SiCplusplus, SiTensorflow, SiPytorch, SiJenkins, SiNextdotjs, SiTypescript, SiTailwindcss } from "react-icons/si";
import { DiJavascript } from "react-icons/di";
import MathworksIcon from "@/components/MathworksIcon";

export const links = [
  {
    name: "Home",
    hash: "/",
  },
  {
    name: "About",
    hash: "/about",
  },
  {
    name: "Projects",
    hash: "/projects",
  },
  {
    name: "Experience",
    hash: "/experience",
  },
] as const;


export const experiencesData = [
  {
    title: "University of Toronto, BASc",
    location: "Toronto, ON",
    description:
      "Enrolled in the Engineering Science program, specializing in Robotics Engineering.",
    icon: React.createElement(LuGraduationCap),
    date: "2021 - present",
  },
  {
    title: "Software Engineer Intern - RTX, Pratt & Whitney",
    location: "Mississauga, ON",
    description:
      "Worked on building internal software tools for the Control Systems team.",
    icon: React.createElement(CgWorkAlt),
    date: "May 2022 - Aug 2022",
  },
  {
    title: "Software Engineer Intern - RTX, Pratt & Whitney",
    location: "Mississauga, ON",
    description:
      "Return offer to continue building software tools for the Control Systems team. My stack includes React, JavaScript, and Oracle SQL.",
    icon: React.createElement(CgWorkAlt),
    date: "May 2023 - Aug 2023",
  },
  {
    title: "Software and Controls Intern - General Motors",
    location: "Markham, ON",
    description:
      "Developing software and controls for the GM EV3, an autonomous electric vehicle platform.",
    icon: React.createElement(CgWorkAlt),
    date: "May 2024 - present",
  },
  {
    title: "AI Researcher - Toronto Robotics + AI Lab",
    location: "Toronto, ON",
    description:
      "Authoring 2 papers on a Bayesian Attention-based 3D lane detection model and BoreasLane, the first 3D winter condition lane dataset.",
    icon: React.createElement(CgWorkAlt),
    date: "May 2024 - present",
  },
  {
    title: "Co-Founder - TARS-AI",
    location: "Toronto, ON",
    description:
      "Co-launched an open-source community with the mission of building the robot TARS from Interstellar.",
    icon: React.createElement(FaGithub),
    date: "Dec 2024 - present",
  },
] as const;

export const projectsData = [
  {
    title: "TARS-AI",
    description: "Co-launched an open-source community with the mission of building the robot TARS from Interstellar.",
    tags: ["Python", "Raspberry Pi", "Fusion360", "Speech Recognition", "LLM", "Text-to-Speech"],
    imageUrl: tarsImg,
    slug: "tars-ai",
    longDescription: [
      "TARS-AI is an ambitious open-source project that aims to recreate the iconic robot from the movie Interstellar. As a co-founder of this initiative, I led the development of the core systems that enable human-robot interaction and mechanical control.",
      "The project utilizes a Raspberry Pi as its brain, running on Python to integrate various AI models for natural language processing. We implemented a sophisticated text-to-speech system that captures TARS's distinctive communication style, complete with adjustable humor settings.",
      "One of our biggest challenges was designing the mechanical structure that would allow for the unique movement seen in the film. Using Fusion360, we created detailed 3D models and implemented a modular design that allows for easy assembly and maintenance."
    ],
    links: [
      {
        title: "GitHub",
        url: "https://github.com/pyrater/TARS-AI",
        icon: "FaGithub"
      },
      {
        title: "Youtube",
        url: "https://www.youtube.com/@TARS-AI.py.youtube",
        icon: "FaYoutube"
      },
      {
        title: "Instagram",
        url: "https://www.instagram.com/tars.ai.py/",
        icon: "FaInstagram"
      },
      {
        title: "Tiktok",
        url: "https://www.tiktok.com/@tars.ai.py",
        icon: "FaTiktok"
      },
      {
        title: "Discord",
        url: "https://discord.gg/uXkqkz3mJJ",
        icon: "FaDiscord"
      }
    ]
  },
  {
    title: "BoreasLane: 3D Lane Dataset",
    description:
      "Creating the first publicly available 3D winter condition lane dataset. Targeting submission to the International Conference on Computer Vision (ICCV).",
    tags: ["Python", "AWS", "OpenStreetMap", "OpenCV"],
    imageUrl: boreaslaneImg,
    slug: "boreaslane",
    longDescription: [
      "BoreasLane is an initiative under the Toronto Robotics + AI Lab to create the first publicly available 3D lane dataset tailored for winter conditions. This project is part of WinTOR, a collaborative research program focused on advancing self-driving car technology in Canadian winters.",
      "My contributions involved developing a high-performance pipeline for annotating the dataset by integrating sensor data from cameras, GPS, and LiDAR point clouds. Using techniques like caching, multiprocessing, and vectorized operations, I reduced preprocessing and labeling runtimes by 43%, enabling faster iterations and scalability.",
      "The 3D lane labeling pipeline combines 2D lane annotations from satellite imagery with sensor data collected during vehicle drives. Lane markings are projected into the vehicle’s frame of reference and refined using LiDAR point clouds for high-accuracy 3D annotations. These annotations are exported in the OpenLane format to support model benchmarking.",
      "Future work involves automating the entire data generation process, starting with unlabelled satellite imagery and leveraging HD maps for a 2D Bird’s Eye View Lane Detection Module. The ultimate goal is to publish the BoreasLane dataset alongside a research paper and to develop a Bayesian Attention Network-based 3D lane detection model, enabling uncertainty-aware segmentation for adverse weather conditions."
    ],
    links: [
      {
        title: "Coming Soon",
        url: "https://github.com/TRAILab",
        icon: "FaGithub"
      },
      {
        title: "WinTOR Program",
        url: "https://robotics.utoronto.ca/news/wintor-new-partnership-will-train-self-driving-cars-to-handle-tough-winter-conditions/",
        icon: "FaExternalLinkAlt"
      },
      {
        title: "TRAIL Lab",
        url: "https://www.trailab.utias.utoronto.ca/",
        icon: "FaExternalLinkAlt"
      }
    ]
  },
  {
    title: "State Estimation for Autonomous Vehicles",
    description:
      "As Team Lead, I developed C++ multi-sensor fusion algorithms for state estimation and localization.",
    tags: ["C++", "Python", "ROS2", "Linux", "Google Test"],
    imageUrl: autorontoImg,
    slug: "autoronto",
    longDescription: [
      "As the Lead of the State Estimation Team at aUToronto, I led the development of multi-sensor fusion algorithms using an Extended Kalman Filter (EKF). This system integrated data from GPS, IMUs, wheel encoders, LiDARs and cameras to ensure accurate localization, even under sensor failure conditions.",
      "To test and enhance the system, I implemented a variable L-Band attenuator to simulate GPS signal degradation during vehicle testing. This allowed us to evaluate the EKF's robustness and dynamically pivot between sensors using integrity monitoring. The system leveraged a chi-squared test to analyze residuals and validate sensor reliability.",
      "I also designed a custom bias-tee PCB to solve power supply issues in the GPS system. This solution enabled simultaneous RF signal and DC current transmission, ensuring reliable GPS operation during testing. Additionally, I developed a Map Offset GUI using PyQt to correct positional and heading errors, reducing localization inaccuracies by 87%.",
      "Through rigorous testing and iteration with Google Test and GMock, I helped lead to our team to secure 1st place in all events at the SAE AutoDrive Challenge."
    ],
    links: [
      {
        title: "SAE AutoDrive R2Y3 - 1st Place",
        url: "https://news.engineering.utoronto.ca/u-of-ts-self-driving-car-team-places-first-at-2024-autodrive-challenge-ii/",
        icon: "FaExternalLinkAlt"
      },
      {
        title: "aUToronto",
        url: "https://www.autodrive.utoronto.ca/",
        icon: "FaExternalLinkAlt"
      },
    ]
  },
  {
    title: "SynthBoard: Audio Synthesizer",
    description:
      "Developed an audio synthesizer with a 4x4 button interface, interactive LEDs, and 8 knobs for real-time audio generation and waveform manipulation.",
    tags: ["C/C++", "STM32", "Fusion360", "Circuit Design", "DSP"],
    imageUrl: synthboardImg,
    slug: "synthboard",
    longDescription: [
      "SynthBoard is an audio synthesizer designed to bring professional-grade audio generation and waveform manipulation to an accessible, open-source platform. The device features a 4x4 button interface, individually addressable RGB LEDs, and 8 potentiometers for real-time control of waveform parameters and audio effects.",
      "At its core, the SynthBoard uses the STM32F407 microcontroller, using its built-in audio DAC and GPIO capabilities. I implemented a button matrix with ghosting prevention via diodes. Additionally, the RGB LED lighting effects were achieved using WS2812B LEDs in a daisy-chain configuration, allowing individual control with minimal wiring.",
      "The potentiometers were integrated with the STM32 ADC channels to provide precise control over parameters such as waveform type, harmonic content, and ADSR envelope settings. Each knob directly adjusts key synthesis features like attack, decay, sustain, release, and low-pass filter cutoff frequencies.",
      "On the software side, I developed modular C++ classes for components like oscillators, ADSR envelopes, and low-pass filters. The system supports sine, square, triangle, and sawtooth waveforms, with additive synthesis principles enabling rich harmonic generation. Inline functions, integer arithmetic, and bitwise operations were used to optimize performance for real-time audio processing on resource-constrained hardware.",
      "The entire design, including the enclosure and components, was modeled and validated in Fusion360. Key elements like button clamps, LED prisms, and potentiometer housings were 3D printed with precision for durability and compatibility.",
    ],
    links: [
      {
        title: "GitHub",
        url: "https://github.com/alexander-wang03/SynthBoard",
        icon: "FaGithub"
      },
      {
        title: "Project Video",
        url: "https://www.youtube.com/watch?v=wo0ibzK1-dg&feature=youtu.be&themeRefresh=1",
        icon: "FaYoutube"
      },
    ]
  },
  {
    title: "Autonomous Package Delivery Robot",
    description:
      "Designed an autonomous package delivery robot using Bayesian Localization and a line-following PID controller.",
    tags: ["Python", "ROS", "Turtlebot 3 Waffle Pi"],
    imageUrl: packagebotImg,
    slug: "packagebot",
    longDescription: [
      "This project involved designing and implementing an autonomous package delivery robot using the TurtleBot 3 Waffle Pi platform. The robot was tasked with navigating a closed-loop hallway environment, identifying delivery points represented by colored patches, and executing precise delivery maneuvers.",
      "The navigation system combined a finely tuned PID controller for line-following with Bayesian Localization for accurate state estimation. The PID controller, implemented in ROS, dynamically adjusted the robot's angular velocity to maintain smooth tracking of the white tape path. Localization was achieved by processing color data from the robot's camera, classifying it into predefined categories using HSV thresholds, and updating the robot's position probabilities based on Bayesian principles.",
      "Key innovations included adaptive thresholding to account for environmental lighting variations and dynamic confidence checks to trigger delivery actions.",
      "The robot's delivery mechanism was automated through a series of sequential actions: stopping at the correct office, performing a 90-degree turn, pausing to simulate delivery, and reorienting itself to continue navigation.",
    ],
    links: [
      {
        title: "GitHub",
        url: "https://github.com/alexander-wang03/Autonomous-Package-Delivery-Robot",
        icon: "FaGithub"
      },
      {
        title: "Demo Video",
        url: "https://www.youtube.com/watch?v=i5FRlQ0tfMQ",
        icon: "FaYoutube"
      },
    ]
  },
] as const;

export const skillsData = [
  {
    name: "Python",
    icon: FaPython,
  },
  {
    name: "C/C++",
    icon: SiCplusplus,
  },
  {
    name: "MATLAB",
    icon: MathworksIcon,
  },
  {
    name: "Simulink",
    icon: MathworksIcon,
  },
  {
    name: "ROS2",
    icon: FaRobot,
  },
  {
    name: "Linux",
    icon: FaLinux,
  },
  {
    name: "AWS",
    icon: FaAws,
  },
  {
    name: "TensorFlow",
    icon: SiTensorflow,
  },
  {
    name: "PyTorch",
    icon: SiPytorch,
  },
  {
    name: "Git",
    icon: FaGitAlt,
  },
  {
    name: "Jenkins",
    icon: SiJenkins,
  },
  {
    name: "JavaScript",
    icon: DiJavascript,
  },
  {
    name: "TypeScript",
    icon: SiTypescript,
  },
  {
    name: "React",
    icon: FaReact,
  },
  {
    name: "Next.js",
    icon: SiNextdotjs,
  },
  {
    name: "Tailwind",
    icon: SiTailwindcss,
  },
] as const;
