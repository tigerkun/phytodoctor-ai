import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { LazyImage } from '@/components/ui/lazy-image';

type BlogType = {
  title: string;
  href: string;
  description: string;
  author: string;
  createdAt: string;
  readTime: string;
  image: string;
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=800&auto=format&fit=crop';

const blogs: BlogType[] = [
  {
    title: 'Trees warn neighbours with ethylene',
    href: 'https://en.wikipedia.org/wiki/Plant_communication',
    description:
      'When browsers strip an Acacia, the tree vents ethylene. Nearby trees smell it and flood their leaves with tannins within minutes — a chemical alarm that turns a meal bitter before the next giraffe arrives.',
    image:
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=800&auto=format&fit=crop',
    createdAt: '2026-10-12',
    author: 'Guild Codex',
    readTime: '4 min read',
  },
  {
    title: 'Venus flytraps count to two',
    href: 'https://en.wikipedia.org/wiki/Venus_flytrap',
    description:
      'One brush of a trigger hair does nothing. A second within ~20 seconds snaps the trap. Further hits start digestion. Raindrops fail the count, so the plant does not waste energy on weather.',
    image:
      'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=800&auto=format&fit=crop',
    createdAt: '2026-09-28',
    author: 'Field Notes',
    readTime: '5 min read',
  },
  {
    title: 'Welwitschia: two leaves, 1,500 years',
    href: 'https://en.wikipedia.org/wiki/Welwitschia',
    description:
      'Namib Desert plants of Welwitschia mirabilis grow only two leaves, forever. They shred into straps, drink fog through the leaf surface, and outlive empires on almost no rain.',
    image:
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=800&auto=format&fit=crop',
    createdAt: '2026-09-14',
    author: 'Arid Botany Desk',
    readTime: '6 min read',
  },
  {
    title: 'Pando is one tree wearing a forest',
    href: 'https://en.wikipedia.org/wiki/Pando_(tree)',
    description:
      'Utah’s quaking aspen clone shares one root system and about 47,000 stems. Genetically it is a single organism, thousands of years old — older than the timber we cut from it.',
    image:
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=800&auto=format&fit=crop',
    createdAt: '2026-08-30',
    author: 'Guild Codex',
    readTime: '5 min read',
  },
  {
    title: 'The wood-wide web is a sugar railroad',
    href: 'https://en.wikipedia.org/wiki/Mycorrhizal_network',
    description:
      'Fungi thread between tree roots and move carbon, nitrogen, and warning chemicals. Shaded seedlings have been measured surviving on sugars donated by established neighbours through that network.',
    image:
      'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop',
    createdAt: '2026-08-11',
    author: 'Soil Lab',
    readTime: '7 min read',
  },
  {
    title: 'Rafflesia: a metre of rotting-meat perfume',
    href: 'https://en.wikipedia.org/wiki/Rafflesia_arnoldii',
    description:
      'The corpse flower has no leaves, stem, or roots of its own. It parasitises Tetrastigma vines and opens a bloom up to 1 m across that smells of carrion so flies will ferry its pollen.',
    image:
      'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=800&auto=format&fit=crop',
    createdAt: '2026-07-22',
    author: 'Tropical Desk',
    readTime: '6 min read',
  },
  {
    title: 'Lotus leaves taught us self-cleaning paint',
    href: 'https://en.wikipedia.org/wiki/Lotus_effect',
    description:
      'Wax crystals on Nelumbo leaves make water bead and roll, sweeping dirt with it. Engineers copied that microtexture for façades, textiles, and glass that rinse themselves in rain.',
    image:
      'https://images.unsplash.com/photo-1490750967868-88aa4486c461?q=80&w=800&auto=format&fit=crop',
    createdAt: '2026-07-04',
    author: 'Field Notes',
    readTime: '4 min read',
  },
  {
    title: 'Bamboo’s 90 cm day',
    href: 'https://en.wikipedia.org/wiki/Bamboo',
    description:
      'Some temperate bamboos elongate about 90 cm in 24 hours — roughly a millimetre every 90 seconds — because cells along the whole culm expand together, not because a tip is racing.',
    image:
      'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?q=80&w=800&auto=format&fit=crop',
    createdAt: '2026-06-18',
    author: 'Growth Lab',
    readTime: '5 min read',
  },
  {
    title: 'Eucalypts that wait for fire',
    href: 'https://en.wikipedia.org/wiki/Serotiny',
    description:
      'Resin seals many eucalypt capsules until bushfire heat melts the lock. Seeds then drop onto ash-rich, competitor-free soil — a regeneration strategy that looks like destruction from the ground.',
    image:
      'https://images.unsplash.com/photo-1509316785289-025f5b846b35?q=80&w=800&auto=format&fit=crop',
    createdAt: '2026-05-29',
    author: 'Fire Ecology',
    readTime: '6 min read',
  },
  {
    title: 'NASA’s live map of a restless planet',
    href: 'https://eonet.gsfc.nasa.gov/',
    description:
      'EONET streams open wildfires, storms, volcanoes, dust, and ice events as they are detected. The same feed powers the Telegraph Wire on this page — a botanist’s weather report for the biosphere.',
    image:
      'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=800&auto=format&fit=crop',
    createdAt: '2026-10-20',
    author: 'NASA EONET',
    readTime: '3 min read',
  },
  {
    title: 'Mangroves are coastal insurance',
    href: 'https://earthobservatory.nasa.gov/features/Mangroves',
    description:
      'A mangrove belt knocks down storm surge, traps sediment, and stores carbon in waterlogged peat. Losing the fringe is not just a wildlife story — it is a seawall coming down.',
    image:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop',
    createdAt: '2026-04-16',
    author: 'Earth Observatory',
    readTime: '8 min read',
  },
  {
    title: 'A banana is a berry. A strawberry is not.',
    href: 'https://en.wikipedia.org/wiki/Berry_(botany)',
    description:
      'Botany counts ovaries, not desserts. A berry is fruit from one ovary with seeds inside — banana, kiwi, grape. A strawberry is an accessory fruit; those “seeds” are achenes, each a tiny dry fruit.',
    image:
      'https://images.unsplash.com/photo-1464226184884-fa280b87c399?q=80&w=800&auto=format&fit=crop',
    createdAt: '2026-03-08',
    author: 'Guild Codex',
    readTime: '4 min read',
  },
];

export function BlogsSection() {
  return (
    <section aria-labelledby="library-blog-heading" className="mx-auto w-full grow">
      <div className="space-y-1 py-2">
        <h2
          id="library-blog-heading"
          className="font-serif font-semibold text-2xl tracking-wide text-text-bark md:text-4xl"
        >
          Field library
        </h2>
        <p className="text-text-stone text-sm md:text-base font-serif">
          Plant facts, pathology asides, and environment dispatches — each plate a photograph and a short read.
        </p>
      </div>
      <div className="my-4 h-px w-full bg-[#8c7355]/30" />
      <div className="z-10 grid md:grid-cols-2 lg:grid-cols-3">
        {blogs.map((blog) => (
          <BlogCard {...blog} key={blog.title} />
        ))}
      </div>
    </section>
  );
}

function BlogCard({
  title,
  description,
  createdAt,
  readTime,
  image,
  author,
  href,
  className,
}: ComponentProps<'a'> & BlogType) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'rounded-lg group flex flex-col gap-2 p-3 min-h-[44px] hover:bg-[#8c7355]/8 active:bg-[#8c7355]/12',
        className,
      )}
    >
      <LazyImage
        alt={title}
        className="transition-all duration-500 group-hover:scale-105"
        containerClassName="rounded-lg shadow-md"
        fallback={FALLBACK_IMAGE}
        inView={true}
        ratio={16 / 9}
        src={image}
      />
      <div className="space-y-2 px-2 pb-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-stone group-hover:text-text-bark sm:text-xs font-sans">
          <p>by {author}</p>
          <div className="size-1 rounded-full bg-text-stone" />
          <p>{createdAt}</p>
          <div className="size-1 rounded-full bg-text-stone" />
          <p>{readTime}</p>
        </div>
        <h3 className="line-clamp-2 font-serif font-semibold text-lg text-text-bark">{title}</h3>
        <p className="line-clamp-3 text-text-stone text-sm group-active:text-text-bark font-sans">
          {description}
        </p>
      </div>
    </a>
  );
}

export default BlogsSection;
