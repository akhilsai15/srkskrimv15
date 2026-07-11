import re

with open('src/components/SparkRow.tsx', 'r') as f:
    content = f.read()

replacements = [
    ('{spark.isCollab ? (', '{latestSpark.isCollab ? ('),
    ('className={`relative w-[60px] h-[36px] flex items-center justify-start mt-2 mb-2 ${spark.status === \'pending\' ? \'opacity-60\' : \'\'}`}', 'className={`relative w-[60px] h-[36px] flex items-center justify-start mt-2 mb-2 ${latestSpark.status === \'pending\' ? \'opacity-60\' : \'\'}`}'),
    ('className={`w-[36px] h-[36px] rounded-full p-[2px] ${spark.status === \'pending\' ? \'border-2 border-dashed border-white/40 bg-transparent\' : ringClass} absolute left-0 z-10`} style={spark.status === \'pending\' ? {} : ringStyle}', 'className={`w-[36px] h-[36px] rounded-full p-[2px] ${latestSpark.status === \'pending\' ? \'border-2 border-dashed border-white/40 bg-transparent\' : ringClass} absolute left-0 z-10`} style={latestSpark.status === \'pending\' ? {} : ringStyle}'),
    ('style={{ animation: hasViewed ? \'none\' : `spin ${getEnergyAnimationDuration(spark.energy)} linear infinite reverse` }}', 'style={{ animation: hasViewed ? \'none\' : `spin ${getEnergyAnimationDuration(sparkEnergy)} linear infinite reverse` }}'),
    ('src={spark.creator?.avatar || spark.user?.avatar}', 'src={latestSpark.creator?.avatar || latestSpark.user?.avatar || spark.user?.avatar}'),
    ('className={`w-[36px] h-[36px] rounded-full p-[2px] ${spark.status === \'pending\' ? \'border-2 border-dashed border-white/40 bg-transparent\' : ringClass} absolute left-[24px] z-20`} style={spark.status === \'pending\' ? {} : ringStyle}', 'className={`w-[36px] h-[36px] rounded-full p-[2px] ${latestSpark.status === \'pending\' ? \'border-2 border-dashed border-white/40 bg-transparent\' : ringClass} absolute left-[24px] z-20`} style={latestSpark.status === \'pending\' ? {} : ringStyle}'),
    ('src={spark.collabPartner?.avatar}', 'src={latestSpark.collabPartner?.avatar}'),
    ('className={`absolute -bottom-2 -right-1 bg-[#121212] rounded-full px-1.5 py-0.5 border border-white/20 z-30 ${spark.status === \'pending\' ? \'text-[10px] text-white/70\' : \'text-[10px]\'}`, 'className={`absolute -bottom-2 -right-1 bg-[#121212] rounded-full px-1.5 py-0.5 border border-white/20 z-30 ${latestSpark.status === \'pending\' ? \'text-[10px] text-white/70\' : \'text-[10px]\'}`'),
    ('{spark.status === \'pending\' ? \'⏳\' : \'👥\'}', '{latestSpark.status === \'pending\' ? \'⏳\' : \'👥\'}'),
    ('{spark.type === \'image\' && (', '{latestSpark.type === \'image\' && ('),
    ('{spark.type === \'video\' && (', '{latestSpark.type === \'video\' && ('),
    ('{spark.duration && <span className="text-[9px] font-bold text-white">0:{spark.duration.toString().padStart(2, \'0\')}</span>}', '{latestSpark.duration && <span className="text-[9px] font-bold text-white">0:{latestSpark.duration.toString().padStart(2, \'0\')}</span>}'),
    ('{spark.isChallenge && !hasViewed && !isExpiringSoon && (', '{latestSpark.isChallenge && !hasViewed && !isExpiringSoon && ('),
    ('{spark.isCollab && !hasViewed && !isExpiringSoon && (', '{latestSpark.isCollab && !hasViewed && !isExpiringSoon && ('),
    ('{spark.isCollab ? `${(spark.creator?.username || spark.user?.username)?.replace(\'@\', \'\')} + ${(spark.collabPartner?.username)?.replace(\'@\', \'\')}` : spark.user?.username}', '{latestSpark.isCollab ? `${(latestSpark.creator?.username || latestSpark.user?.username || spark.user?.username)?.replace(\'@\', \'\')} + ${(latestSpark.collabPartner?.username)?.replace(\'@\', \'\')}` : spark.user?.username}')
]

for src, dst in replacements:
    content = content.replace(src, dst)

with open('src/components/SparkRow.tsx', 'w') as f:
    f.write(content)

print('Updated successfully!')
