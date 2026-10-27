package basic.urlshortner.repository;

import basic.urlshortner.entity.Url;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;


public interface UrlRepository extends JpaRepository<Url, UUID> {
    Optional<Url> findUrlByShortUrl(String shortUrl);
}
