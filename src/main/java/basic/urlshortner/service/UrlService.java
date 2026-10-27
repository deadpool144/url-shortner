package basic.urlshortner.service;

import basic.urlshortner.dto.UrlResponeDto;
import basic.urlshortner.entity.Url;
import basic.urlshortner.exception.GlobalExceptionHandler;
import basic.urlshortner.exception.UrlNotFoundException;
import basic.urlshortner.repository.UrlRepository;
import lombok.AllArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;


import java.time.LocalDateTime;
import java.util.Base64;
import java.util.concurrent.TimeUnit;


@Service
@Slf4j
@RequiredArgsConstructor
public class UrlService {

    private final UrlRepository urlRepository;

    private final RedisTemplate<String, String> redisTemplate;

    private final String URL_COUNTER_KEY = "global:url:counter";
    private static final String URL_CACHE_PREFIX = "url::";

    @Cacheable(value="url", key="#shortUrl")
    public String getDestinationUrl(String shortUrl) {
        return  urlRepository.findUrlByShortUrl(shortUrl)
                .map(url -> url.getOriginalUrl())
                .orElseThrow(()->new UrlNotFoundException("url not found"));




    }

    public UrlResponeDto createShortUrl(String Orignalurl) {

        Long uniqueId = redisTemplate.opsForValue().increment(URL_COUNTER_KEY);
        String shortUrl = Base64.getUrlEncoder().withoutPadding().encodeToString(uniqueId.toString().getBytes());

        log.info("Creating short url with id {} and original url {}", uniqueId, shortUrl);

        Url url =new Url();
        url.setShortUrl(shortUrl);
        url.setCreatedAt(LocalDateTime.now());
        url.setOriginalUrl(Orignalurl);

        Url savedUrl = urlRepository.save(url);

        log.info("Saved url with id {} and original url {}", uniqueId, savedUrl);


        return mapToUrlResponsDto(savedUrl);


    }



    private UrlResponeDto mapToUrlResponsDto(Url url) {
        UrlResponeDto urlResponeDto = new UrlResponeDto();

        urlResponeDto.setShortUrl(url.getShortUrl());
        urlResponeDto.setOriginalUrl(url.getOriginalUrl());
        urlResponeDto.setCreatedAt(url.getCreatedAt());
        log.info("mapToUrlResponeDto {}", urlResponeDto);

        return urlResponeDto;
    }
}
