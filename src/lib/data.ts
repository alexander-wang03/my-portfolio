import React from "react";
import { CgWorkAlt } from "react-icons/cg";
import { FaReact } from "react-icons/fa";
import { LuGraduationCap } from "react-icons/lu";
import tarsImg from "@/assets/tars.png";
import boreaslaneImg from "@/assets/boreaslane.png";
import autorontoImg from "@/assets/autoronto.jpg";
import synthboardImg from "@/assets/synthboard.png";
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
    description:
      "Co-launched an open-source community with the mission of building the robot TARS from Interstellar.",
    tags: ["Python", "Raspberry Pi", "Fusion360","Speech Recognition", "LLM", "Text-to-Speech"],
    imageUrl: tarsImg,
    slug: "tars-ai",
  },
  {
    title: "BoreasLane: 3D Lane Dataset",
    description:
      "Creating the first publicly available 3D winter condition lane dataset. Targeting submission to the International Conference on Computer Vision (ICCV).",
    tags: ["Python", "AWS", "OpenStreetMap", "OpenCV"],
    imageUrl: boreaslaneImg,
    slug: "boreaslane",
  },
  {
    title: "State Estimation for Autonomous Vehicles",
    description:
      "As Team Lead, I developed C++ multi-sensor fusion algorithms for state estimation and localization.",
    tags: ["C++", "Python", "ROS2", "Linux", "Google Test"],
    imageUrl: autorontoImg,
    slug: "autoronto",
  },
  {
    title: "SynthBoard: Audio Synthesizer",
    description:
      "Developed an audio synthesizer with a 4x4 button interface, interactive LEDs, and 8 knobs for real-time audio generation and waveform manipulation.",
    tags: ["C++", "STM32", "Fusion360", "Circuit Design"],
    imageUrl: synthboardImg,
    slug: "synthboard",
  },
  {
    title: "Autonomous Package Delivery Robot",
    description:
      "Designed an autonomous package delivery robot using Bayesian Localization and a line-following PID controller.",
    tags: ["Python", "ROS", "Turtlebot 3 Waffle Pi"],
    imageUrl: packagebotImg,
    slug: "packagebot",
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
