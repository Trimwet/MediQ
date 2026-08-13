import { createFileRoute } from '@tanstack/react-router'
import { galleryImages } from '@/data/landing/gallery'

export const Route = createFileRoute('/_public/gallery')({
  component: GalleryPage,
})

function GalleryPage() {
  return (
    <div className='pb-24'>
      {/* Header */}
      <section className='bg-muted/40 py-24 text-center'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <h1 className='font-manrope text-4xl font-bold tracking-tight mb-6 sm:text-5xl'>
            Hospital Gallery
          </h1>
          <p className='mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed'>
            Take a visual tour of our state-of-the-art facilities, advanced
            medical equipment, and dedicated care environments.
          </p>
        </div>
      </section>

      <div className='mx-auto max-w-6xl px-4 sm:px-6 py-20'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {galleryImages.map((image, index) => (
            <div
              key={index}
              className='group relative overflow-hidden rounded-xl aspect-[4/3] cursor-pointer'
            >
              <img
                src={image.url}
                alt={image.title}
                className='size-full object-cover transition-transform duration-700 group-hover:scale-110'
                referrerPolicy='no-referrer'
              />
              <div className='absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6'>
                <h4 className='text-white font-bold text-lg'>{image.title}</h4>
              </div>
            </div>
          ))}
        </div>

        {/* Virtual Tour */}
        <div className='mt-20 overflow-hidden rounded-2xl bg-primary px-8 py-16 text-center relative md:p-20'>
          <div className='absolute inset-0 opacity-20'>
            <img
              src='https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=2000'
              alt='Hospital Video'
              className='size-full object-cover'
              referrerPolicy='no-referrer'
            />
          </div>
          <div className='relative z-10 mx-auto max-w-2xl'>
            <h2 className='font-manrope text-3xl font-bold text-primary-foreground mb-6 sm:text-4xl'>
              Watch Our Virtual Tour
            </h2>
            <p className='text-lg text-primary-foreground/80 mb-10'>
              Experience our hospital through a comprehensive video tour
              showcasing our patient-first approach.
            </p>
            <button className='flex size-20 items-center justify-center rounded-full bg-primary-foreground text-primary mx-auto shadow-xl transition-transform hover:scale-110'>
              <div className='ml-1 size-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-primary border-b-[10px] border-b-transparent' />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
