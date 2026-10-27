package basic.urlshortner.dto;

import jakarta.persistence.Column;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UrlResponeDto {


    private String OriginalUrl;

    private String ShortUrl;

    private LocalDateTime CreatedAt;


}
