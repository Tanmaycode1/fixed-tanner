const getImageUrl = (url: string) => {
  if (!url) return '';
  
  // If URL is already absolute (starts with http/https) or is a complete S3 URL
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('s3://')) {
    return url;
  }
  
  // Remove any duplicate '/media' prefixes
  let cleanUrl = url;
  if (cleanUrl.startsWith('/media/') || cleanUrl.startsWith('media/')) {
    cleanUrl = cleanUrl.replace(/^\/?(media\/)/g, '');
  }
  
  // Construct URL with API base (which should already include media path settings)
  return `${process.env.NEXT_PUBLIC_API_BASE_URL}/media/${cleanUrl}`;
};

// Fix image rendering in post content
{post.image ? (
  <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-lg">
    <Image
      src={getImageUrl(post.image)}
      alt={post.title || 'Post image'}
      fill
      className="object-cover"
      priority
    />
  </div>
) : null}

// Fix audio rendering
{post.audio_file ? (
  <div className="mt-4">
    <audio
      controls
      className="w-full"
      src={getImageUrl(post.audio_file)}
    >
      Your browser does not support the audio element.
    </audio>
  </div>
) : null}

// Fix user avatar rendering
<div className="flex-shrink-0">
  <Link href={`/${post.author.username}`}>
    <div className="relative h-10 w-10 rounded-full">
      <Image
        src={post.author.profile_picture ? getImageUrl(post.author.profile_picture) : '/default-avatar.png'}
        alt={post.author.username || 'User'}
        className="rounded-full object-cover"
        fill
      />
    </div>
  </Link>
</div> 