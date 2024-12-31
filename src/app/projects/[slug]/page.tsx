import { notFound } from "next/navigation";
import { projectsData } from "@/lib/data";
import Image from "next/image";

export default function ProjectPage({
  params,
}: {
  params: { slug: string };
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
      
      <div className="flex flex-wrap gap-2 mb-8">
        {project.tags.map((tag, index) => (
          <span
            key={index}
            className="bg-black/[0.7] px-3 py-1 text-[0.7rem] uppercase tracking-wider text-white rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="text-lg text-gray-700 dark:text-white/70">
        {project.description}
      </p>
    </main>
  );
}