import React from "react";
import { CgWorkAlt } from "react-icons/cg";
import { FaReact } from "react-icons/fa";
import { LuGraduationCap } from "react-icons/lu";
import corpcommentImg from "@/assets/corpcomment.png";
import rmtdevImg from "@/assets/rmtdev.png";
import wordanalyticsImg from "@/assets/wordanalytics.png";
import { FaPython, FaAws, FaGitAlt, FaLinux, FaRobot} from "react-icons/fa";
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
      "Worked on building interal software tools for the Control Systems team.",
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
    title: "AI Researcher - Toronto Robotics & AI Lab",
    location: "Toronto, ON",
    description:
      "Authoring 2 papers on a Bayesian Attention-based 3D lane detection model and the development of BoreasLane, the first 3D winter condition lane dataset. Targeting submission to the International Conference on Computer Vision (ICCV).",
    icon: React.createElement(CgWorkAlt),
    date: "May 2024 - present",
  },
] as const;


// {
//   title: "University of Toronto, BASc",
//   location: "Toronto, ON",
//   description:
//     "Enrolled in the Engineering Science program, specializing in Robotics Engineering.",
//   icon: React.createElement(LuGraduationCap),
//   date: "2021 - present",
// },
// {
//   title: "Software Engineer Intern - RTX, Pratt & Whitney",
//   location: "Mississauga, ON",
//   description:
//     "Worked on building interal software tools for the Control Systems team.",
//   icon: React.createElement(CgWorkAlt),
//   date: "May 2022 - Aug 2022",
// },// {
//   title: "Software Engineer Intern - RTX, Pratt & Whitney",
//   location: "Mississauga, ON",
//   description:
//     "Return offer to continue building software tools for the Control Systems team.",
//   icon: React.createElement(CgWorkAlt),
//   date: "May 2023 - Aug 2023",
// },

// {
//   title: "Software and Controls Intern - General Motors",
//   location: "Markham, ON",
//   description:
//     "Developing software and controls for the GM EV3, an autonomous electric vehicle platform.",
//   icon: React.createElement(CgWorkAlt),
//   date: "2024 - present",
// },
// {
//   title: "AI & Robotics Researcher - Toronto Robotics",
//   location: "Markham, ON",
//   description:
//     "Developing software and controls for the GM EV3, an autonomous electric vehicle platform.",
//   icon: React.createElement(CgWorkAlt),
//   date: "May 2024 - present",
// },

export const projectsData = [
  {
    title: "CorpComment",
    description:
      "I worked as a full-stack developer on this startup project for 2 years. Users can give public feedback to companies.",
    tags: ["React", "Next.js", "MongoDB", "Tailwind", "Prisma"],
    imageUrl: corpcommentImg,
  },
  {
    title: "rmtDev",
    description:
      "Job board for remote developer jobs. I was the front-end developer. It has features like filtering, sorting and pagination.",
    tags: ["React", "TypeScript", "Next.js", "Tailwind", "Redux"],
    imageUrl: rmtdevImg,
  },
  {
    title: "Word Analytics",
    description:
      "A public web app for quick analytics on text. It shows word count, character count and social media post limits.",
    tags: ["React", "Next.js", "SQL", "Tailwind", "Framer"],
    imageUrl: wordanalyticsImg,
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
