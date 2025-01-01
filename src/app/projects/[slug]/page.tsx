import { notFound } from "next/navigation";
import { projectsData } from "@/lib/data";
import Image from "next/image";
import { FaGithub, FaYoutube, FaExternalLinkAlt, FaDiscord, FaInstagram, FaTiktok} from "react-icons/fa";

const iconMap = {
  FaGithub,
  FaYoutube,
  FaExternalLinkAlt,
  FaDiscord,
  FaInstagram,
  FaTiktok
};

export default async function ProjectPage({
  params,
}: {
  params: { slug: string }
}) {
  const project = projectsData.find((project) => project.slug === params.slug);

  if (!project) {
    notFound();
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="relative w-full h-[400px] mb-8">
        <Image
          src={project.imageUrl}
          alt={project.title}
          fill
          className="object-cover object-top rounded-xl"
        />
      </div>
      
      <h1 className="text-4xl font-bold mb-4">{project.title}</h1>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {project.tags.map((tag, index) => (
          <span
            key={index}
            className="bg-black/[0.7] px-3 py-1 text-[0.7rem] uppercase tracking-wider text-white rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
        {project.links.map((link, index) => {
          const Icon = iconMap[link.icon as keyof typeof iconMap];
          return (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {Icon && <Icon className="w-5 h-5" />}
              <span>{link.title}</span>
            </a>
          );
        })}
      </div>

      <div className="space-y-6">
        {project.longDescription.map((paragraph, index) => (
          <p 
            key={index}
            className="text-lg leading-relaxed text-gray-700 dark:text-white/70"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </main>
  );
}