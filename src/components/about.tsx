"use client";

import React from "react";
import SectionHeading from "./section-heading";
import { motion } from "framer-motion";
import Image from "next/image";
import profile2Img from "@/assets/profile2.png";

export default function About() {
  return (
    <section className="mb-28 max-w-[80rem] text-center sm:mb-40 scroll-mt-28">
      <SectionHeading>About me</SectionHeading>
      <div className="flex items-center justify-between gap-8">
        <motion.div
          className="flex-1 max-w-[50rem] text-left"
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="mb-3">
            Ever since I was young, I&apos;ve been fascinated by robotics and space travel, earning my {" "}
            <span className="font-medium">Pilot&apos;s License</span> at just 17 years old 🛩️. Now, I&apos;m pursuing a degree in {" "}
            <span className="font-medium">Robotics Engineering</span> at the University of Toronto 🎓, where I&apos;m hoping to contribute my love for robotics to the world.
          </p>

          <p className="mb-3">I&apos;m currently:</p>
            <ul className="list-disc list-inside">
              <li>
                Interning at <span className="font-medium">General Motors</span>, working on control systems for their electric vehicles 🚙.
              </li>
              <li>
                Serving as a <span className="font-medium">Team Lead</span> for my university&apos;s 1st place finishing autonomous vehicle team, aUToronto.
              </li>
              <li>
                Conducting <span className="font-medium">AI research</span> at the Toronto Robotics and AI Lab to bring self-driving cars to Canada ☃️.
              </li>
            </ul>
          <br />
          <p className="mb-3">
            As a creator, I co-founded <span className="font-medium">TARS-AI</span>, an open-source community dedicated to recreating the robot TARS from <span className="italic">Interstellar</span>. I believe in {" "}
            <span className="font-medium"> the democratization of robotics</span>—there&apos;s a tinkerer inside of everyone.
          </p>

          <p>
            <span className="italic">When I&apos;m not building or coding</span>, I enjoy reading about {" "}
            <span className="font-medium">history and geography</span>, going to the gym, or unwinding with mangas and novels. I&apos;m always excited to learn, create, and contribute to a future where everyone can be a creator.
          </p>
        </motion.div>

        <div className="relative flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              type: "tween",
              duration: 0.2,
            }}
          >
            <div className="relative w-80 h-80">
              <Image
                src={profile2Img}
                alt="profile picture"
                fill={true}
                quality="95"
                priority={true}
                className="rounded-full object-cover border-[0.35rem] border-white shadow-xl"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
