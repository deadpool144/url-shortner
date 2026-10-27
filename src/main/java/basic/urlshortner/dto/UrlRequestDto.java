package basic.urlshortner.dto;


import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UrlRequestDto {

    @NotBlank(message = "URL cannot be blank, empty, or null!")
    private String url;
}
