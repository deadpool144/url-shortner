package basic.urlshortner.controller;


import basic.urlshortner.dto.UrlRequestDto;
import basic.urlshortner.dto.UrlResponeDto;
import basic.urlshortner.service.UrlService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Base64;

@RestController
@RequestMapping("/api/v1/url")
@Slf4j
@RequiredArgsConstructor
public class UrlController {

    private final UrlService urlService;


    @GetMapping("/{shortUrl}")
     public ResponseEntity<Void> getAndRedirect(@PathVariable String shortUrl) {
        String redirectingUrl=urlService.getDestinationUrl(shortUrl);

        URI targetUri = UriComponentsBuilder.fromUriString(redirectingUrl)
                .build()
                .toUri();
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(targetUri)
                .build();


    }

    @PostMapping("/create-shortUrl")
    public ResponseEntity<UrlResponeDto>  createShortUrl(@Valid @RequestBody UrlRequestDto urlRequestDto) {
         return ResponseEntity.ok(urlService.createShortUrl(urlRequestDto.getUrl()));

    }

}
